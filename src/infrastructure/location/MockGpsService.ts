import { GeoLocation, GetLocationOptions, IGpsService } from '../../application/services/IGpsService';

export class MockGpsService implements IGpsService {
  private stored: GeoLocation | null;
  private shouldThrow: boolean;

  constructor(initial?: GeoLocation | null, shouldThrow = false) {
    this.stored = initial ?? null;
    this.shouldThrow = shouldThrow;
  }

  async getBestLocation(options?: GetLocationOptions): Promise<GeoLocation | null> {
    if (this.shouldThrow) throw new Error('permission_denied');
    // In the mock we simply return the configured stored value as "current"
    return this.stored;
  }

  getLastKnownLocation(): GeoLocation | null {
    return this.stored;
  }

  async persistLastKnownLocation(loc: GeoLocation): Promise<void> {
    this.stored = loc;
  }
}

export default MockGpsService;
