// Integration test: AddTaskDocumentUseCase — document persisted with taskId

jest.mock('react-native-sqlite-storage', () => {
  function createAdapter(db: any) {
    return {
      executeSql: async (sql: string, params: any[] = []) => {
        const stmt = sql.trim();
        const upper = stmt.toUpperCase();
        if (upper.startsWith('SELECT')) {
          const rows = db.prepare(stmt).all(...params);
          return [{ rows: { length: rows.length, item: (i: number) => rows[i] } }];
        }
        if (params && params.length > 0) {
          try {
            const prepared = db.prepare(stmt);
            prepared.run(...params);
            return [{ rows: { length: 0, item: (_: number) => undefined } }];
          } catch {
            // fallthrough
          }
        }
        if (stmt) db.exec(stmt);
        return [{ rows: { length: 0, item: (_: number) => undefined } }];
      },
      transaction: async (fn: any) => {
        db.exec('BEGIN');
        try {
          const tx = { executeSql: (sql: string, params?: any[]) => createAdapter(db).executeSql(sql, params) };
          await fn(tx);
          db.exec('COMMIT');
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }
      },
      close: async () => db.close(),
    };
  }
  return {
    enablePromise: (_: boolean) => {},
    openDatabase: async (_: any) => {
      const BetterSqlite3 = require('better-sqlite3');
      const db = new BetterSqlite3(':memory:');
      return createAdapter(db);
    },
  };
});

import { DrizzleDocumentRepository } from '../../../../infrastructure/repositories/DrizzleDocumentRepository';
import { AddTaskDocumentUseCase } from '../../application/AddTaskDocumentUseCase';
import { IFileSystemAdapter } from '../../../../infrastructure/files/IFileSystemAdapter';
import { initDatabase } from '../../../../infrastructure/database/connection';

function makeMockFileSystem(localPath = '/app/storage/test.pdf'): IFileSystemAdapter {
  return {
    copyToAppStorage: jest.fn().mockResolvedValue(localPath),
    getDocumentsDirectory: jest.fn().mockResolvedValue('/app/storage'),
    exists: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  };
}

describe('AddTaskDocumentUseCase (integration)', () => {
  let docRepo: DrizzleDocumentRepository;

  beforeAll(async () => {
    await initDatabase();
    docRepo = new DrizzleDocumentRepository();
  });

  it('persists a document with the correct taskId and status', async () => {
    const fsAdapter = makeMockFileSystem('/app/storage/site-report.pdf');
    const uc = new AddTaskDocumentUseCase(docRepo, fsAdapter);

    const doc = await uc.execute({
      taskId: 'task-doc-integration-1',
      sourceUri: 'file:///tmp/site-report.pdf',
      filename: 'site-report.pdf',
      mimeType: 'application/pdf',
      size: 98765,
    });

    expect(doc.id).toBeTruthy();
    expect(doc.taskId).toBe('task-doc-integration-1');
    expect(doc.status).toBe('local-only');
    expect(doc.localPath).toBe('/app/storage/site-report.pdf');
    expect(doc.source).toBe('import');

    // Verify persistence via repository
    const persisted = await docRepo.findByTaskId('task-doc-integration-1');
    expect(persisted).toHaveLength(1);
    expect(persisted[0].taskId).toBe('task-doc-integration-1');
    expect(persisted[0].filename).toBe('site-report.pdf');
  });

  it('creates multiple documents for the same task', async () => {
    const fsAdapter = makeMockFileSystem('/app/storage/doc2.pdf');
    const uc = new AddTaskDocumentUseCase(docRepo, fsAdapter);

    await uc.execute({ taskId: 'task-multi', sourceUri: 'file:///a.pdf', filename: 'a.pdf' });
    await uc.execute({ taskId: 'task-multi', sourceUri: 'file:///b.pdf', filename: 'b.pdf' });

    const docs = await docRepo.findByTaskId('task-multi');
    expect(docs.length).toBeGreaterThanOrEqual(2);
  });
});
