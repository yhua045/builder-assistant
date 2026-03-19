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
          } catch (_) {
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

import { DrizzleAuditLogRepository } from '../../src/infrastructure/repositories/DrizzleAuditLogRepository';
import { AuditLog } from '../../src/domain/entities/AuditLog';
import { initDatabase, closeDatabase } from '../../src/infrastructure/database/connection';

describe('DrizzleAuditLogRepository integration (better-sqlite3 :memory:)', () => {
  let repo: DrizzleAuditLogRepository;

  beforeEach(async () => {
    await closeDatabase();
    repo = new DrizzleAuditLogRepository();
    const { db } = await initDatabase();
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        local_id    INTEGER PRIMARY KEY AUTOINCREMENT,
        id          TEXT NOT NULL UNIQUE,
        project_id  TEXT NOT NULL,
        task_id     TEXT,
        timestamp_utc INTEGER NOT NULL,
        source      TEXT NOT NULL,
        action      TEXT NOT NULL
      )
    `);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  function makeEntry(id: string, overrides: Partial<AuditLog> = {}): AuditLog {
    return {
      id,
      projectId: 'proj-1',
      timestampUtc: new Date().toISOString(),
      source: 'Task Form',
      action: `Action ${id}`,
      ...overrides,
    };
  }

  it('save + findByProjectId round-trip', async () => {
    const entry = makeEntry('audit-1', { taskId: 'task-1' });
    await repo.save(entry);

    const results = await repo.findByProjectId('proj-1');

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('audit-1');
    expect(results[0].projectId).toBe('proj-1');
    expect(results[0].taskId).toBe('task-1');
    expect(results[0].source).toBe('Task Form');
    expect(results[0].action).toBe('Action audit-1');
    // timestampUtc should be a valid ISO string
    expect(() => new Date(results[0].timestampUtc)).not.toThrow();
  });

  it('findByTaskId scopes correctly to the given task', async () => {
    await repo.save(makeEntry('a1', { taskId: 'task-A' }));
    await repo.save(makeEntry('b1', { taskId: 'task-B' }));
    await repo.save(makeEntry('a2', { taskId: 'task-A' }));

    const forTaskA = await repo.findByTaskId('task-A');
    const forTaskB = await repo.findByTaskId('task-B');

    expect(forTaskA).toHaveLength(2);
    expect(forTaskA.every(e => e.taskId === 'task-A')).toBe(true);
    expect(forTaskB).toHaveLength(1);
    expect(forTaskB[0].id).toBe('b1');
  });

  it('findByProjectId returns entries in DESC timestamp order', async () => {
    const t1 = new Date('2026-01-01T10:00:00.000Z');
    const t2 = new Date('2026-01-02T10:00:00.000Z');
    const t3 = new Date('2026-01-03T10:00:00.000Z');

    await repo.save(makeEntry('e1', { timestampUtc: t1.toISOString() }));
    await repo.save(makeEntry('e2', { timestampUtc: t3.toISOString() }));
    await repo.save(makeEntry('e3', { timestampUtc: t2.toISOString() }));

    const results = await repo.findByProjectId('proj-1');

    expect(results[0].id).toBe('e2'); // newest
    expect(results[1].id).toBe('e3');
    expect(results[2].id).toBe('e1'); // oldest
  });

  it('stores and retrieves an entry without a taskId', async () => {
    const entry = makeEntry('no-task', { taskId: undefined });
    await repo.save(entry);

    const results = await repo.findByProjectId('proj-1');

    expect(results).toHaveLength(1);
    expect(results[0].taskId).toBeUndefined();
  });
});
