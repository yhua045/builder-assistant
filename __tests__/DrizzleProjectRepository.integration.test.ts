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

import { DrizzleProjectRepository } from '../src/infrastructure/repositories/DrizzleProjectRepository';
import { ProjectEntity, ProjectStatus } from '../src/domain/entities/Project';
import { closeDatabase } from '../src/infrastructure/database/connection';

describe('DrizzleProjectRepository integration (better-sqlite3 :memory:)', () => {
  it('runs real SQL via Drizzle: create, read, update, delete', async () => {
    const repo = new DrizzleProjectRepository();

    const projectEntity = ProjectEntity.create({
      id: 'int-project-1',
      name: 'Drizzle Integration Project',
      status: ProjectStatus.IN_PROGRESS,
      materials: [ { id: 'm1', name: 'Cement', quantity: 10, unit: 'bag', unitCost: 7 } ],
      phases: [ { id: 'p1', name: 'Excavation' } ]
    });

    await repo.init();

    // save
    await repo.save(projectEntity.data);

    // find
    const loaded = await repo.findById('int-project-1');
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe('Drizzle Integration Project');
    // primary key assigned by SQLite
    expect(loaded!.localId).toBeDefined();
    expect(loaded!.localId).toBeGreaterThan(0);
    expect(loaded!.materials.length).toBe(1);
    expect(loaded!.materials[0].localId).toBeDefined();
    expect(loaded!.materials[0].localId).toBeGreaterThan(0);
    expect(loaded!.phases[0].localId).toBeDefined();
    expect(loaded!.phases[0].localId).toBeGreaterThan(0);

    // update: change name and add material
    const updated = { ...projectEntity.data, name: 'Drizzle Integration Project Renamed', materials: [ ...(projectEntity.data.materials || []), { id: 'm2', name: 'Sand', quantity: 20, unit: 'kg', unitCost: 0.2 } ] };
    await repo.update(updated as any);

    const afterUpdate = await repo.findById('int-project-1');
    expect(afterUpdate).not.toBeNull();
    expect(afterUpdate!.name).toBe('Drizzle Integration Project Renamed');
    expect(afterUpdate!.materials.length).toBe(2);
    const newMat = afterUpdate!.materials.find(m => m.id === 'm2');
    expect(newMat).toBeDefined();
    expect(newMat!.localId).toBeDefined();
    expect(newMat!.localId).toBeGreaterThan(0);

    // delete
    await repo.delete('int-project-1');
    const afterDelete = await repo.findById('int-project-1');
    expect(afterDelete).toBeNull();

    // close underlying DB
    await closeDatabase();
  }, 15000);
});
