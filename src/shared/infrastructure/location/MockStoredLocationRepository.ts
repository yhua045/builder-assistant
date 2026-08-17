import { StoredLocationRepository } from '../../../shared/domain/repositories/StoredLocationRepository.ts';
import { GeoLocation } from '../../application/ports/IGpsService';

export class MockStoredLocationRepository implements StoredLocationRepository {
  private stored: GeoLocation | null = null;

  constructor(initial?: GeoLocation | null) {
    this.stored = initial ?? null;
  }

  async getLastKnown(): Promise<GeoLocation | null> {
    return this.stored;
  }

  async save(loc: GeoLocation): Promise<void> {
    this.stored = loc;
  }
}

export default MockStoredLocationRepository;
