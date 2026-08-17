import { GeoLocation, GetLocationOptions } from '../../../../shared/application/ports/IGpsService';
import { StoredLocationRepository } from '../../../../shared/domain/repositories/StoredLocationRepository';

// Minimal device provider type used by the use case. Infrastructure adapters
// should provide a compatible implementation.
export type DeviceLocationProvider = {
  getCurrentLocation(options?: GetLocationOptions): Promise<GeoLocation | null>;
};

export class GetBestLocationUseCase {
  private cache: GeoLocation | null = null;

  constructor(
    private readonly deviceProvider: DeviceLocationProvider,
    private readonly storedRepo: StoredLocationRepository,
  ) {}

  getLastKnownLocation(): GeoLocation | null {
    return this.cache;
  }

  async loadCacheIfNeeded(): Promise<void> {
    if (this.cache !== null) return;
    const last = await this.storedRepo.getLastKnown();
    if (last) this.cache = last;
  }

  async persistLastKnownLocation(loc: GeoLocation): Promise<void> {
    await this.storedRepo.save(loc);
    this.cache = loc;
  }

  async getBestLocation(options?: GetLocationOptions): Promise<GeoLocation | null> {
    await this.loadCacheIfNeeded();

    if (options?.maxAgeMs && this.cache) {
      const age = Date.now() - Date.parse(this.cache.timestamp);
      if (age <= options.maxAgeMs) return this.cache;
    }

    try {
      const fix = await this.deviceProvider.getCurrentLocation(options);
      if (fix) {
        if (options?.requiredAccuracyMeters == null || (fix.accuracyMeters ?? Infinity) <= options.requiredAccuracyMeters) {
          await this.persistLastKnownLocation(fix);
          return fix;
        }
      }
    } catch {
      // treat as permission or provider failure; fall back to cache
    }

    return this.cache;
  }
}

export default GetBestLocationUseCase;
