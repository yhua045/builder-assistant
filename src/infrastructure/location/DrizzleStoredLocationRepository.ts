import { initDatabase, getDatabase } from '../database/connection';
import { StoredLocationRepository } from '../../domain/repositories/StoredLocationRepository';
import { GeoLocation } from '../../application/services/IGpsService';

const LOCATION_LOG_RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

export class DrizzleStoredLocationRepository implements StoredLocationRepository {
  private initialized = false;

  async initIfNeeded() {
    if (this.initialized) return;
    await initDatabase();
    this.initialized = true;
  }

  async getLastKnown(): Promise<GeoLocation | null> {
    await this.initIfNeeded();
    const { db } = getDatabase();

    const [result] = await db.executeSql(
      'SELECT * FROM last_known_locations ORDER BY saved_at DESC LIMIT 1'
    );
    if (result.rows.length === 0) return null;
    const row = result.rows.item(0);
    return {
      latitude: row.latitude,
      longitude: row.longitude,
      accuracyMeters: row.accuracy_meters ?? undefined,
      altitude: row.altitude ?? null,
      timestamp: row.timestamp,
    };
  }

  async save(loc: GeoLocation): Promise<void> {
    await this.initIfNeeded();
    const { db } = getDatabase();

    const savedAt = Date.now();

    await db.transaction(async (tx) => {
      await tx.executeSql(
        `INSERT INTO last_known_locations (latitude, longitude, accuracy_meters, altitude, timestamp, saved_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [loc.latitude, loc.longitude, loc.accuracyMeters ?? null, loc.altitude ?? null, loc.timestamp, savedAt]
      );

      // prune old rows
      const threshold = savedAt - LOCATION_LOG_RETENTION_MS;
      await tx.executeSql(
        `DELETE FROM last_known_locations WHERE saved_at < ?`,
        [threshold]
      );
    });
  }
}

export default DrizzleStoredLocationRepository;
