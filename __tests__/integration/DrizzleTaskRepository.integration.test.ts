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

        // If params are provided, use a prepared statement (handles placeholders)
        if (params && params.length > 0) {
          try {
            const prepared = db.prepare(stmt);
            prepared.run(...params);
            return [ { rows: { length: 0, item: (_: number) => undefined } } ];
          } catch (e) {
            // fallthrough to exec
          }
        }

        // No params or prepared failed: try exec (for DDL or simple statements)
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
      // require inside factory to satisfy Jest's mock factory constraints
      const BetterSqlite3 = require('better-sqlite3');
      const db = new BetterSqlite3(':memory:');
      return createAdapter(db);
    }
  };
});

import { DrizzleTaskRepository } from '../../src/infrastructure/repositories/DrizzleTaskRepository';
import { TaskEntity } from '../../src/domain/entities/Task';
import { closeDatabase, initDatabase } from '../../src/infrastructure/database/connection';

describe('DrizzleTaskRepository integration (better-sqlite3 :memory:)', () => {
  let repo: DrizzleTaskRepository;

  beforeAll(async () => {
    // Initialize DB (runs migrations including our manual 0008)
    await initDatabase();
    repo = new DrizzleTaskRepository();
  });

  afterAll(async () => {
    // await closeDatabase(); // optional if supported
  });

  it('performs CRUD operations', async () => {
    // Create
    const taskEntity = TaskEntity.create({
      title: 'Test Task',
      description: 'Initial description',
      projectId: 'proj-1',
      status: 'pending',
      priority: 'medium'
    });
    
    await repo.save(taskEntity.data());
    
    // Read
    const loaded = await repo.findById(taskEntity.data().id);
    expect(loaded).toBeDefined();
    expect(loaded?.title).toBe('Test Task');
    expect(loaded?.status).toBe('pending');
    expect(loaded?.localId).toBeDefined();

    // Update
    const updatedTask = { 
      ...loaded!, 
      status: 'in_progress', 
      notes: 'Progress notes',
      isScheduled: true,
      scheduledAt: new Date().toISOString()
    } as const;
    
    // Cast to compatible type or use specific update logic if needed, 
    // but repo.update takes Task interface which matches.
    await repo.update(updatedTask);
    
    const reloaded = await repo.findById(taskEntity.data().id);
    expect(reloaded?.status).toBe('in_progress');
    expect(reloaded?.notes).toBe('Progress notes');
    expect(reloaded?.isScheduled).toBe(true);
    expect(reloaded?.scheduledAt).toBeDefined();

    // List by Project
    const projectTasks = await repo.findByProjectId('proj-1');
    expect(projectTasks.length).toBeGreaterThan(0);
    expect(projectTasks[0].id).toBe(taskEntity.data().id);

    // Delete
    await repo.delete(taskEntity.data().id);
    const deleted = await repo.findById(taskEntity.data().id);
    expect(deleted).toBeNull();
  });

  it('supports ad-hoc tasks (no project)', async () => {
    const adHocTask = TaskEntity.create({
      title: 'Ad-hoc Task',
      // No projectId
      status: 'pending'
    });

    await repo.save(adHocTask.data());

    const loaded = await repo.findById(adHocTask.data().id);
    expect(loaded?.projectId).toBeUndefined();
    
    const adHocList = await repo.findAdHoc();
    expect(adHocList.some(t => t.id === adHocTask.data().id)).toBe(true);
  });
});
