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

import { DrizzleProjectRepository } from '../../src/infrastructure/repositories/DrizzleProjectRepository';
import { ProjectEntity, ProjectStatus } from '../../src/domain/entities/Project';
import { closeDatabase, getDatabase } from '../../src/infrastructure/database/connection';

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
    const newMat = afterUpdate!.materials.find((m: any) => m.id === 'm2');
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
  // Contract-style tests (create, findByExternalId, list, count, withTransaction)
  it('integration: repository contract methods (create, findByExternalId, list, count, withTransaction)', async () => {
    const repo: any = new DrizzleProjectRepository();

    await repo.init();

    // save (upsert) then verify
    await repo.save?.({ id: 'int-project-2', name: 'Created Project', status: ProjectStatus.PLANNING, materials: [], phases: [], meta: { externalId: 'ext-123' } });
    const created = await repo.findById('int-project-2');
    expect(created).toBeDefined();

    // findByExternalId
    const byExternal = await repo.findByExternalId?.('ext-123');
    expect(byExternal).not.toBeNull();
    expect(byExternal?.id).toBe('int-project-2');

    // list & count
    const listRes = await repo.list?.({}, { limit: 10 });
    expect(listRes).toBeDefined();
    expect(Array.isArray(listRes.items)).toBeTruthy();

    const total = await repo.count?.({});
    expect(typeof total).toBe('number');

    // withTransaction: perform a transaction and rollback on error
    try {
      await repo.withTransaction(async (txRepo: any) => {
        await txRepo.save({ id: 'tx-proj', name: 'Tx Project', status: ProjectStatus.PLANNING, materials: [], phases: [] });
        throw new Error('force rollback');
      });
    } catch (e) {
      // expected
    }

    const txCheck = await repo.findById('tx-proj');
    expect(txCheck).toBeNull();

    // cleanup
    await repo.delete?.('int-project-2');
    await closeDatabase();
  }, 15000);

  it('returns hydrated project details for owner and property', async () => {
    const repo = new DrizzleProjectRepository();
    await repo.init();

    const { db } = getDatabase();

    await db.executeSql(
      `INSERT INTO contacts (id, name, roles, email, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      ['contact-1', 'Owner Person', JSON.stringify(['OWNER']), 'owner@example.com', Date.now(), Date.now()]
    );

    await db.executeSql(
      `INSERT INTO properties (id, address, owner_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
      ['prop-1', '123 Main St', 'contact-1', Date.now(), Date.now()]
    );

    const projectEntity = ProjectEntity.create({
      id: 'details-project-1',
      name: 'Details Project',
      status: ProjectStatus.IN_PROGRESS,
      ownerId: 'contact-1',
      propertyId: 'prop-1',
      materials: [],
      phases: [],
    });

    await repo.save(projectEntity.data);

    const details = await repo.findDetailsById('details-project-1');
    expect(details).not.toBeNull();
    expect(details!.owner.id).toBe('contact-1');
    expect(details!.owner.name).toBe('Owner Person');
    expect(details!.property?.id).toBe('prop-1');
    expect(details!.property?.address).toBe('123 Main St');

    const listDetails = await repo.listDetails({}, { limit: 10 });
    const listed = listDetails.items.find((item) => item.id === 'details-project-1');
    expect(listed).toBeDefined();
    expect(listed!.owner.id).toBe('contact-1');
    expect(listed!.property?.id).toBe('prop-1');

    await repo.delete('details-project-1');
    await closeDatabase();
  }, 15000);

  it('persists and retrieves defaultDueDateDays via save/findById', async () => {
    const repo = new DrizzleProjectRepository();
    await repo.init();

    const projectData = ProjectEntity.create({
      name: 'Due Date Project',
      status: ProjectStatus.PLANNING,
      defaultDueDateDays: 10,
      materials: [],
      phases: [],
    }).data;

    await repo.save(projectData);
    const found = await repo.findById(projectData.id);

    expect(found).not.toBeNull();
    expect(found!.defaultDueDateDays).toBe(10);

    // Update and verify the field is persisted
    await repo.save({ ...found!, defaultDueDateDays: 14 });
    const updated = await repo.findById(projectData.id);
    expect(updated!.defaultDueDateDays).toBe(14);

    await repo.delete(projectData.id);
    await closeDatabase();
  }, 15000);

});
  // End of contract tests

