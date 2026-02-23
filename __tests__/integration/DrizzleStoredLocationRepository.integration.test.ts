// Mock react-native-sqlite-storage with a small adapter backed by better-sqlite3 (:memory:)
jest.mock('react-native-sqlite-storage', () => {
  function createAdapter(db: any) {
    return {
      executeSql: async (sql: string, params: any[] = []) => {
        const stmt = sql.trim();
        const upper = stmt.toUpperCase();

        if (upper.startsWith('SELECT')) {
          const rows = db.prepare(stmt).all(...params);
          return [ { rows: { length: rows.length, item: (i: number) => rows[i] } } ];
        }

        if (params && params.length > 0) {
          const prepared = db.prepare(stmt);
          prepared.run(...params);
          return [ { rows: { length: 0, item: (_: number) => undefined } } ];
        }

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
      return createAdapter(db);
    }
  };
});

import { initDatabase, getDatabase, closeDatabase } from '../../src/infrastructure/database/connection';
import { DrizzleStoredLocationRepository } from '../../src/infrastructure/location/DrizzleStoredLocationRepository';
import { GeoLocation } from '../../src/application/services/IGpsService';

describe('DrizzleStoredLocationRepository (integration)', () => {
  beforeAll(async () => {
    await initDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  test('save() then getLastKnown() roundtrip', async () => {
    const repo = new DrizzleStoredLocationRepository();
    const loc: GeoLocation = {
      latitude: 12.34,
      longitude: 56.78,
      accuracyMeters: 8,
      altitude: null,
      timestamp: new Date().toISOString(),
    };

    await repo.save(loc);

    const got = await repo.getLastKnown();
    expect(got).not.toBeNull();
    expect(got?.latitude).toBeCloseTo(loc.latitude, 6);
    expect(got?.longitude).toBeCloseTo(loc.longitude, 6);
    expect(got?.timestamp).toBe(loc.timestamp);

    // cleanup: remove any rows we added
    const { db } = getDatabase();
    await db.executeSql('DELETE FROM last_known_locations');
  });
});
