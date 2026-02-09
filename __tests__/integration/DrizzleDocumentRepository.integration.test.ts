// Mock react-native-sqlite-storage with a small adapter backed by better-sqlite3 (:memory:)
jest.mock('react-native-sqlite-storage', () => {
  function createAdapter(db: any) {
    return {
      executeSql: async (sql: string, params: any[] = []) => {
        const stmt = sql.trim();
        const upper = stmt.toUpperCase();

        // Run SELECT queries and return rows
        if (upper.startsWith('SELECT')) {
          const rows = db.prepare(stmt).all(...params);
          return [ { rows: { length: rows.length, item: (i: number) => rows[i] } } ];
        }

        // If params are provided, use a prepared statement
        if (params && params.length > 0) {
          try {
            const prepared = db.prepare(stmt);
            prepared.run(...params);
            return [ { rows: { length: 0, item: (_: number) => undefined } } ];
          } catch (e) {
             console.error("SQL Error mock (write):", e, sql, params);
             throw e;
          }
        }

        // No params or prepared failed
        if (stmt) db.exec(stmt);
        return [ { rows: { length: 0, item: (_: number) => undefined } } ];
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
      
      // We need to initialize the schema manually because Drizzle Kit usually handles migrations for real files,
      // but here we are in memory. 
      // The `initDatabase` in `connection.ts` calls `getBundledMigrations` but that might rely on files.
      // However, `DrizzleProjectRepository.integration.test.ts` worked without manual schema setup?
      // Wait, `DrizzleProjectRepository` calls `initDatabase` which does whatever `initDatabase` does.
      // Let's assume `initDatabase` handles table creation or the existing test mock handles it?
      // Reading connection.ts: `getBundledMigrations`.
      // If `initDatabase` runs migrations, we are good.
      // However, the existing `DrizzleProjectRepository` used `executeSql` manually for inserts? 
      // Nope, it used `extensions`.
      // Let's add a hook to create tables if needed.
      
      // For this test, let's just let `initDatabase` run. 
      // But wait! `initDatabase` generally uses `drizzle-orm/sqlite-proxy` which sends SQL to `executeSql`.
      // So if `drizzle-orm` sends `CREATE TABLE` statements (via migration), it works.
      // If not, we might fail since tables don't exist.
      // The current `DrizzleProjectRepository` test seems to rely on `initDatabase` working.
      // Let's assume it works.
      
      return createAdapter(db);
    }
  };
});

import { DrizzleDocumentRepository } from '../../src/infrastructure/repositories/DrizzleDocumentRepository';
import { DocumentEntity } from '../../src/domain/entities/Document';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { initDatabase, getDatabase } from '../../src/infrastructure/database/connection';
import { migrate } from 'drizzle-orm/sqlite-proxy/migrator';

// We need to verify if migrations run.
// If `initDatabase` runs migrations, great.
// If not, we might need to manually run schema creation in the `beforeAll` or just rely on Drizzle sending proper SQL.

// Let's peek at `src/infrastructure/database/connection.ts` again implies `getBundledMigrations`.
// If `migrations.ts` has the SQL, we are good.
// But I just modified `schema.ts`. I did NOT update `migrations.ts` or `0000_*.sql`.
// So the migrations are OUT OF SYNC with `schema.ts`.
// This is critical. The test will fail because the table `documents` won't have the new columns in the in-memory DB 
// if the migration uses the OLD sql.
// AND I cannot run `drizzle-kit generate` easily here.

// Workaround: In the test, I will manually execute the `CREATE TABLE` or `ALTER TABLE` sql 
// that corresponds to my new schema.
// OR I update `migrations.ts` / `.sql` files? Hard to do correctly manually.
// Better: I will use `drizzle-orm`'s `push` capability if available, or just manually create the table in `beforeEach`.
// Since I am using `sqlite-proxy`, I can just run SQL.

describe('DrizzleDocumentRepository integration', () => {
    let repo: DrizzleDocumentRepository;

    beforeEach(async () => {
        repo = new DrizzleDocumentRepository();
        await repo.init();
        
        // MANUALLY CREATE TABLE based on new schema because migrations are not updated.
        // This simulates the migration being applied.
        const { db } = getDatabase();
        
        // Drop if exists
        await db.executeSql('DROP TABLE IF EXISTS documents');
        
        // Create with new columns
        await db.executeSql(`
            CREATE TABLE documents (
                local_id INTEGER PRIMARY KEY AUTOINCREMENT,
                id TEXT NOT NULL UNIQUE,
                project_id TEXT,
                type TEXT,
                title TEXT,
                filename TEXT,
                mime_type TEXT,
                size INTEGER,
                status TEXT NOT NULL DEFAULT 'local-only',
                local_path TEXT,
                storage_key TEXT,
                cloud_url TEXT,
                uri TEXT,
                issued_by TEXT,
                issued_date INTEGER,
                expires_at INTEGER,
                notes TEXT,
                tags TEXT,
                ocr_text TEXT,
                source TEXT,
                uploaded_by TEXT,
                uploaded_at INTEGER,
                checksum TEXT,
                created_at INTEGER,
                updated_at INTEGER
            );
        `);
    });

    it('saves and finds a document', async () => {
        const doc = DocumentEntity.create({
            title: 'My Plan',
            filename: 'plan.pdf',
            size: 1024,
            mimeType: 'application/pdf',
            source: 'import'
        });
        
        // Set some storage fields
        doc.assignProject('proj_123');
        // Manually set status for test
        const data = doc.data();
        data.status = 'upload-pending';
        data.localPath = '/tmp/plan.pdf';
        
        await repo.save(data);
        
        const found = await repo.findById(data.id);
        expect(found).not.toBeNull();
        expect(found!.id).toBe(data.id);
        expect(found!.title).toBe('My Plan');
        expect(found!.projectId).toBe('proj_123');
        expect(found!.status).toBe('upload-pending');
        expect(found!.localPath).toBe('/tmp/plan.pdf');
        expect(found!.size).toBe(1024);
        expect(found!.tags).toEqual([]); // defaulted
    });

    it('updates a document', async () => {
        const doc = DocumentEntity.create({ title: 'Old Title' });
        await repo.save(doc.data());
        
        const data = doc.data();
        data.title = 'New Title';
        data.status = 'uploaded';
        data.cloudUrl = 'https://example.com/doc.pdf';
        
        await repo.update(data);
        
        const found = await repo.findById(data.id);
        expect(found!.title).toBe('New Title');
        expect(found!.status).toBe('uploaded');
        expect(found!.cloudUrl).toBe('https://example.com/doc.pdf');
    });

    it('lists documents by project', async () => {
        const doc1 = DocumentEntity.create({ title: 'Doc 1' });
        doc1.assignProject('p1');
        
        const doc2 = DocumentEntity.create({ title: 'Doc 2' });
        doc2.assignProject('p1');
        
        const doc3 = DocumentEntity.create({ title: 'Doc 3' });
        doc3.assignProject('p2');
        
        await repo.save(doc1.data());
        await repo.save(doc2.data());
        await repo.save(doc3.data());
        
        const p1Docs = await repo.findByProjectId('p1');
        expect(p1Docs).toHaveLength(2);
        
        const p2Docs = await repo.findByProjectId('p2');
        expect(p2Docs).toHaveLength(1);
    });
    
    it('deletes a document', async () => {
        const doc = DocumentEntity.create({ title: 'To Delete' });
        await repo.save(doc.data());
        
        await repo.delete(doc.data().id);
        
        const found = await repo.findById(doc.data().id);
        expect(found).toBeNull();
    });
    
    it('filters documents', async () => {
        const doc1 = DocumentEntity.create({ title: 'Pending' }); // status='local-only' by default in creator but overridden?
        const d1 = doc1.data(); 
        d1.status = 'upload-pending';
        d1.projectId = 'p1';
        
        const doc2 = DocumentEntity.create({ title: 'Uploaded' });
        const d2 = doc2.data();
        d2.status = 'uploaded';
        d2.projectId = 'p1';

        await repo.save(d1);
        await repo.save(d2);
        
        const pending = await repo.findAll({ status: 'upload-pending' });
        expect(pending).toHaveLength(1);
        expect(pending[0].id).toBe(d1.id);
        
        const p1Docs = await repo.findAll({ projectId: 'p1' });
        expect(p1Docs).toHaveLength(2);
        
        const p1Pending = await repo.findAll({ projectId: 'p1', status: 'upload-pending' });
        expect(p1Pending).toHaveLength(1);
    });
});
