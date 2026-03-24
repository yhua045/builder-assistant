// Integration test: DrizzleContactRepository with new issue #171 fields

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
          } catch (_e) {
            // fallthrough
          }
        }

        if (stmt) db.exec(stmt);
        return [{ rows: { length: 0, item: (_: number) => undefined } }];
      },
      transaction: async (fn: any) => {
        db.exec('BEGIN');
        try {
          const tx = {
            executeSql: (sql: string, params?: any[]) => createAdapter(db).executeSql(sql, params),
          };
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

import { DrizzleContactRepository } from '../../src/infrastructure/repositories/DrizzleContactRepository';
import { ContactEntity } from '../../src/domain/entities/Contact';
import { closeDatabase } from '../../src/infrastructure/database/connection';

describe('DrizzleContactRepository — issue #171 quickadd integration', () => {
  afterEach(async () => {
    await closeDatabase();
  });

  it('save then findById returns the new contact with licenseNumber and usageCount', async () => {
    const repo = new DrizzleContactRepository();
    const entity = ContactEntity.create({
      id: 'contact-int-001',
      name: 'Alice Builder',
      trade: 'Electrical',
      licenseNumber: 'VBA-12345',
      phone: '0400111111',
      usageCount: 0,
    });
    await repo.save(entity.data());

    const found = await repo.findById('contact-int-001');
    expect(found).not.toBeNull();
    expect(found!.name).toBe('Alice Builder');
    expect(found!.licenseNumber).toBe('VBA-12345');
    expect(found!.usageCount).toBe(0);
  });

  it('incrementUsageCount increments by 1 each time', async () => {
    const repo = new DrizzleContactRepository();
    const entity = ContactEntity.create({
      id: 'contact-int-002',
      name: 'Bob Plumber',
      usageCount: 0,
    });
    await repo.save(entity.data());

    await repo.incrementUsageCount('contact-int-002');
    const afterOne = await repo.findById('contact-int-002');
    expect(afterOne!.usageCount).toBe(1);

    await repo.incrementUsageCount('contact-int-002');
    const afterTwo = await repo.findById('contact-int-002');
    expect(afterTwo!.usageCount).toBe(2);
  });

  it('findMostUsed returns contacts ordered by usageCount DESC', async () => {
    const repo = new DrizzleContactRepository();

    const low = ContactEntity.create({ id: 'contact-int-low', name: 'Low User', usageCount: 0 });
    const high = ContactEntity.create({ id: 'contact-int-high', name: 'High User', usageCount: 5 });
    const mid = ContactEntity.create({ id: 'contact-int-mid', name: 'Mid User', usageCount: 3 });

    // Save in arbitrary order
    await repo.save(low.data());
    await repo.save(mid.data());
    await repo.save(high.data());

    // Set usage counts manually via increment (or reload via save with usageCount)
    // Use save with usageCount set already
    await repo.save({ ...high.data(), usageCount: 5 });
    await repo.save({ ...mid.data(), usageCount: 3 });

    const results = await repo.findMostUsed(10);
    const names = results.map((c) => c.name);
    const highIdx = names.indexOf('High User');
    const midIdx = names.indexOf('Mid User');
    const lowIdx = names.indexOf('Low User');

    expect(highIdx).toBeLessThan(midIdx);
    expect(midIdx).toBeLessThan(lowIdx);
  });
});
