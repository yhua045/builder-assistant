jest.mock('react-native-sqlite-storage', () => {
  const BetterSqlite3 = require('better-sqlite3');
  const sharedDb = new BetterSqlite3(':memory:');

  function createAdapter(db: any) {
    return {
      executeSql: async (sql: string, params: any[] = []) => {
        const trimmed = sql.trim();
        const upper = trimmed.toUpperCase();

        if (upper.startsWith('SELECT')) {
          const rows = db.prepare(trimmed).all(...params);
          return [{ rows: { length: rows.length, item: (i: number) => rows[i] } }];
        }

        if (params.length > 0) {
          try {
            db.prepare(trimmed).run(...params);
            return [{ rows: { length: 0, item: () => undefined } }];
          } catch (e) {
            // fall through for DDL / bulk SQL
          }
        }

        db.exec(trimmed);
        return [{ rows: { length: 0, item: () => undefined } }];
      },
      transaction: async (fn: any) => {
        db.exec('BEGIN');
        try {
          const tx = {
            executeSql: (sql: string, params?: any[]) => createAdapter(db).executeSql(sql, params ?? []),
          };
          await fn(tx);
          db.exec('COMMIT');
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }
      },
      close: async () => {
        // preserve the shared in-memory database across reopen simulation
      },
    };
  }

  return {
    enablePromise: (_: boolean) => {},
    openDatabase: async () => createAdapter(sharedDb),
  };
});

import { ReceiveDocumentUseCase } from '../../application/usecases/ReceiveDocumentUseCase';
import { ValidateDocumentUseCase } from '../../application/usecases/ValidateDocumentUseCase';
import type { DocumentChunkingWorkflowRecord, DocumentChunkingWorkflowRepository } from '../../../../shared/domain/repositories/DocumentChunkingWorkflowRepository';
import { closeDatabase, initDatabase } from '../../../../shared/infrastructure/database/connection';
import { DrizzleDocumentChunkingWorkflowRepository } from '../../infrastructure/repositories/DrizzleDocumentChunkingWorkflowRepository';

class InMemoryCheckpointRepository implements DocumentChunkingWorkflowRepository {
  public records: DocumentChunkingWorkflowRecord[] = [];

  async upsert(record: DocumentChunkingWorkflowRecord): Promise<void> {
    this.records.push({ ...record, updatedAt: record.updatedAt ?? Date.now() });
  }

  async findByDocumentVersion(): Promise<DocumentChunkingWorkflowRecord | null> {
    return null;
  }

  async findLatestByDocumentId(): Promise<DocumentChunkingWorkflowRecord | null> {
    return null;
  }

  async findByStatus(): Promise<DocumentChunkingWorkflowRecord[]> {
    return [];
  }
}

describe('Document intake validation integration', () => {
  it('creates a versioned document and validates it in the next step', async () => {
    const receiveUseCase = new ReceiveDocumentUseCase();
    const validateUseCase = new ValidateDocumentUseCase();

    const received = await receiveUseCase.execute({
      sessionId: 'session-10',
      projectId: 'project-20',
      originalFileName: 'plan.pdf',
      sourceType: 'pdf',
      mimeType: 'application/pdf',
      storageKey: 'files/plan.pdf',
      checksum: 'plan-checksum',
    });

    const validated = await validateUseCase.execute({
      documentId: received.documentId,
      documentVersionId: received.documentVersionId,
      sessionId: 'session-10',
      storageKey: 'files/plan.pdf',
      sourceType: 'pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 120_000,
    });

    expect(received.workflowState).toBe('document_received');
    expect(validated.isSupported).toBe(true);
    expect(validated.status).toBe('passed');
    expect(validated.updatedVersion.documentId).toBe(received.documentId);
    expect(validated.updatedVersion.workflowState).toBe('validation_passed');
  });

  it('stops the pipeline on validation failure with a durable rejection reason', async () => {
    const receiveUseCase = new ReceiveDocumentUseCase();
    const validateUseCase = new ValidateDocumentUseCase();

    const received = await receiveUseCase.execute({
      sessionId: 'session-11',
      projectId: 'project-21',
      originalFileName: 'bad.csv',
      sourceType: 'text',
      mimeType: 'text/csv',
      storageKey: 'files/bad.csv',
      checksum: 'bad-checksum',
    });

    const validated = await validateUseCase.execute({
      documentId: received.documentId,
      documentVersionId: received.documentVersionId,
      sessionId: 'session-11',
      storageKey: 'files/bad.csv',
      sourceType: 'text',
      mimeType: 'text/csv',
      fileSizeBytes: 8_000,
    });

    expect(validated.isSupported).toBe(false);
    expect(validated.rejectionCode).toBe('unsupported_file_type');
    expect(validated.updatedVersion.validationStatus).toBe('failed');
    expect(validated.updatedVersion.workflowState).toBe('validation_failed');
  });

  it('persists receive and validation checkpoints into the workflow repository', async () => {
    const repository = new InMemoryCheckpointRepository();
    const receiveUseCase = new ReceiveDocumentUseCase(repository);
    const validateUseCase = new ValidateDocumentUseCase(repository);

    const received = await receiveUseCase.execute({
      sessionId: 'session-12',
      projectId: 'project-22',
      originalFileName: 'report.pdf',
      sourceType: 'pdf',
      mimeType: 'application/pdf',
      storageKey: 'files/report.pdf',
      checksum: 'report-checksum',
    });

    await validateUseCase.execute({
      documentId: received.documentId,
      documentVersionId: received.documentVersionId,
      sessionId: 'session-12',
      storageKey: 'files/report.pdf',
      sourceType: 'pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 120_000,
    });

    expect(repository.records.map(record => record.workflowState)).toEqual([
      'document_received',
      'validation_passed',
    ]);
    expect(repository.records[0].status).toBe('received');
    expect(repository.records[1].status).toBe('validated');
  });

  it('restores workflow checkpoints from SQLite after app restart', async () => {
    const receiveUseCase = new ReceiveDocumentUseCase();
    const validateUseCase = new ValidateDocumentUseCase();

    const received = await receiveUseCase.execute({
      sessionId: 'session-13',
      projectId: 'project-23',
      originalFileName: 'resume.pdf',
      sourceType: 'pdf',
      mimeType: 'application/pdf',
      storageKey: 'files/resume.pdf',
      checksum: 'resume-checksum',
    });

    await validateUseCase.execute({
      documentId: received.documentId,
      documentVersionId: received.documentVersionId,
      sessionId: 'session-13',
      storageKey: 'files/resume.pdf',
      sourceType: 'pdf',
      mimeType: 'application/pdf',
      fileSizeBytes: 150_000,
    });

    await closeDatabase();
    await initDatabase();

    const persistedRepository = new DrizzleDocumentChunkingWorkflowRepository();
    const latestRecord = await persistedRepository.findLatestByDocumentId(received.documentId);

    expect(latestRecord).not.toBeNull();
    expect(latestRecord?.workflowState).toBe('validation_passed');
    expect(latestRecord?.status).toBe('validated');

    await closeDatabase();
  });
});
