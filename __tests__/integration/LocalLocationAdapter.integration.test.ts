// Mock react-native-sqlite-storage with better-sqlite3 :memory: adapter
jest.mock('react-native-sqlite-storage', () => {
  function createAdapter(db: any) {
    return {
      executeSql: async (sql: string, params: any[] = []) => {
        const upper = sql.trim().toUpperCase();
        if (upper.startsWith('SELECT')) {
          const rows = db.prepare(sql).all(...params);
          return [{ rows: { length: rows.length, item: (i: number) => rows[i] } }];
        }
        if (params && params.length > 0) {
          db.prepare(sql).run(...params);
        } else if (sql.trim()) {
          db.exec(sql);
        }
        return [{ rows: { length: 0, item: () => undefined } }];
      },
      transaction: async (fn: any) => {
        db.exec('BEGIN');
        try {
          const tx = { executeSql: (s: string, p?: any[]) => createAdapter(db).executeSql(s, p) };
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
    enablePromise: () => {},
    openDatabase: async () => {
      const BetterSqlite3 = require('better-sqlite3');
      const db = new BetterSqlite3(':memory:');
      return createAdapter(db);
    },
  };
});

import { initDatabase, closeDatabase, getDatabase } from '../../src/infrastructure/database/connection';
import { LocalLocationAdapter } from '../../src/infrastructure/location/LocalLocationAdapter';

// ─── Sydney-area test fixtures ───────────────────────────────────────────────
//
// Reference point: Sydney CBD (-33.8688, 151.2093)
//
// Distances (approximate):
//   close_property  → 0.3 km  (inside 5 km and 2 km radii)
//   medium_property → 2.8 km  (inside 5 km, outside 2 km)
//   far_property    → 12 km   (outside both radii)
//   no_coords       → NULL    (always excluded)
//
const REF_LAT = -33.8688;
const REF_LON = 151.2093;

const FIXTURES = {
  close:   { propId: 'prop-close',  projectId: 'proj-close',  lat: -33.8660, lon: 151.2090, updatedAt: Date.now() },
  medium:  { propId: 'prop-medium', projectId: 'proj-medium', lat: -33.8430, lon: 151.2070, updatedAt: Date.now() - 3600_000 },
  far:     { propId: 'prop-far',    projectId: 'proj-far',    lat: -33.7600, lon: 151.2093, updatedAt: Date.now() - 7200_000 },
  noCoord: { propId: 'prop-nc',     projectId: 'proj-nc',     lat: null,     lon: null,     updatedAt: Date.now() },
};

async function seedFixtures() {
  const { db } = getDatabase();

  for (const f of Object.values(FIXTURES)) {
    await db.executeSql(
      `INSERT OR REPLACE INTO properties (id, address, latitude, longitude, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [f.propId, `${f.propId} St`, f.lat, f.lon, Date.now(), Date.now()],
    );
    await db.executeSql(
      `INSERT OR REPLACE INTO projects (id, property_id, name, status, created_at, updated_at)
       VALUES (?, ?, ?, 'in_progress', ?, ?)`,
      [f.projectId, f.propId, `Project ${f.propId}`, Date.now(), f.updatedAt],
    );
  }
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe('LocalLocationAdapter (integration)', () => {
  beforeAll(async () => {
    await initDatabase();
    await seedFixtures();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('returns properties within the default 5 km radius', async () => {
    const adapter = new LocalLocationAdapter();
    const results = await adapter.findNearbyProjects(REF_LAT, REF_LON);
    const ids = results.map((r) => r.projectId);
    expect(ids).toContain('proj-close');
    expect(ids).toContain('proj-medium');
    expect(ids).not.toContain('proj-far');
  });

  it('excludes properties without coordinates', async () => {
    const adapter = new LocalLocationAdapter();
    const results = await adapter.findNearbyProjects(REF_LAT, REF_LON);
    const ids = results.map((r) => r.projectId);
    expect(ids).not.toContain('proj-nc');
  });

  it('respects a smaller radiusKm option', async () => {
    const adapter = new LocalLocationAdapter();
    const results = await adapter.findNearbyProjects(REF_LAT, REF_LON, { radiusKm: 2 });
    const ids = results.map((r) => r.projectId);
    expect(ids).toContain('proj-close');
    expect(ids).not.toContain('proj-medium');
  });

  it('ranks the closer property higher than the medium one', async () => {
    const adapter = new LocalLocationAdapter();
    const results = await adapter.findNearbyProjects(REF_LAT, REF_LON);
    const closeIdx  = results.findIndex((r) => r.projectId === 'proj-close');
    const mediumIdx = results.findIndex((r) => r.projectId === 'proj-medium');
    expect(closeIdx).toBeGreaterThanOrEqual(0);
    expect(mediumIdx).toBeGreaterThanOrEqual(0);
    expect(closeIdx).toBeLessThan(mediumIdx);
  });

  it('respects maxResults option', async () => {
    const adapter = new LocalLocationAdapter();
    const results = await adapter.findNearbyProjects(REF_LAT, REF_LON, { maxResults: 1 });
    expect(results).toHaveLength(1);
  });

  it('includes distanceMeters and rankingScore on each result', async () => {
    const adapter = new LocalLocationAdapter();
    const [first] = await adapter.findNearbyProjects(REF_LAT, REF_LON, { maxResults: 1 });
    expect(typeof first.distanceMeters).toBe('number');
    expect(first.distanceMeters).toBeGreaterThan(0);
    expect(typeof first.rankingScore).toBe('number');
    expect(first.rankingScore).toBeGreaterThanOrEqual(0);
    expect(first.rankingScore).toBeLessThanOrEqual(1);
  });

  it('returns empty array when no properties are within radius', async () => {
    const adapter = new LocalLocationAdapter();
    // Move reference point far from all fixtures (middle of the Pacific)
    const results = await adapter.findNearbyProjects(0, 0, { radiusKm: 5 });
    expect(results).toEqual([]);
  });
});
