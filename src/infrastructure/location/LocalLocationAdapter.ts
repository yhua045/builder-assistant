import { initDatabase, getDatabase } from '../database/connection';
import {
  ILocationService,
  NearbySearchOptions,
  PropertyMatch,
} from '../../application/services/ILocationService';
import { haversineMeters } from '../../utils/haversine';

const DEFAULT_RADIUS_KM = 5;
const DEFAULT_MAX_RESULTS = 10;
// Degrees of latitude per kilometre (constant everywhere on Earth)
const KM_PER_DEG_LAT = 111.32;

/**
 * Offline-first location adapter.
 *
 * Algorithm:
 *  1. Bounding-box pre-filter — cheap SQL WHERE clause on latitude/longitude.
 *  2. Haversine refinement — exact great-circle distance for survivors.
 *  3. Composite ranking — 70% proximity + 30% recency (project updatedAt).
 */
export class LocalLocationAdapter implements ILocationService {
  private initialized = false;

  private async ensureInit(): Promise<void> {
    if (this.initialized) return;
    await initDatabase();
    this.initialized = true;
  }

  async findNearbyProjects(
    latitude: number,
    longitude: number,
    opts: NearbySearchOptions = {},
  ): Promise<PropertyMatch[]> {
    await this.ensureInit();
    const { db } = getDatabase();

    const radiusKm = opts.radiusKm ?? DEFAULT_RADIUS_KM;
    const maxResults = opts.maxResults ?? DEFAULT_MAX_RESULTS;

    // ── 1. Bounding-box pre-filter ────────────────────────────────────────────
    const deltaLat = radiusKm / KM_PER_DEG_LAT;
    const deltaLon = radiusKm / (KM_PER_DEG_LAT * Math.cos((latitude * Math.PI) / 180));

    const minLat = latitude - deltaLat;
    const maxLat = latitude + deltaLat;
    const minLon = longitude - deltaLon;
    const maxLon = longitude + deltaLon;

    const [result] = await db.executeSql(
      `SELECT
         prop.id            AS property_id,
         prop.address       AS address,
         prop.latitude      AS latitude,
         prop.longitude     AS longitude,
         proj.id            AS project_id,
         proj.updated_at    AS project_updated_at
       FROM properties prop
       INNER JOIN projects proj ON proj.property_id = prop.id
       WHERE prop.latitude IS NOT NULL
         AND prop.longitude IS NOT NULL
         AND prop.latitude  BETWEEN ? AND ?
         AND prop.longitude BETWEEN ? AND ?`,
      [minLat, maxLat, minLon, maxLon],
    );

    type Row = {
      property_id: string;
      address: string | null;
      latitude: number;
      longitude: number;
      project_id: string;
      project_updated_at: number | null;
    };

    const rows: Row[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      rows.push(result.rows.item(i) as Row);
    }

    // ── 2. Haversine refinement ───────────────────────────────────────────────
    const radiusM = radiusKm * 1000;
    const candidates = rows
      .map((row) => ({
        ...row,
        distanceMeters: haversineMeters(latitude, longitude, row.latitude, row.longitude),
      }))
      .filter((c) => c.distanceMeters <= radiusM);

    if (candidates.length === 0) return [];

    // ── 3. Composite ranking ──────────────────────────────────────────────────
    // Recency: normalise updatedAt within candidate set
    const updatedAts = candidates.map((c) => c.project_updated_at ?? 0);
    const minUpdated = Math.min(...updatedAts);
    const maxUpdated = Math.max(...updatedAts);
    const updatedRange = maxUpdated - minUpdated || 1; // avoid /0 for single candidate

    const scored: PropertyMatch[] = candidates.map((c) => {
      const proximityScore = Math.max(0, 1 - c.distanceMeters / radiusM);
      const recencyScore = ((c.project_updated_at ?? 0) - minUpdated) / updatedRange;
      const rankingScore = 0.7 * proximityScore + 0.3 * recencyScore;

      const reason =
        c.distanceMeters < 500
          ? 'very close'
          : c.distanceMeters < 2000
          ? 'close'
          : 'within radius';

      return {
        projectId: c.project_id,
        propertyId: c.property_id,
        address: c.address ?? '',
        latitude: c.latitude,
        longitude: c.longitude,
        distanceMeters: c.distanceMeters,
        rankingScore,
        reason,
      };
    });

    // Sort best first
    scored.sort((a, b) => b.rankingScore - a.rankingScore);

    return scored.slice(0, maxResults);
  }

  computeDistanceMeters(latA: number, lonA: number, latB: number, lonB: number): number {
    return haversineMeters(latA, lonA, latB, lonB);
  }
}

export default LocalLocationAdapter;
