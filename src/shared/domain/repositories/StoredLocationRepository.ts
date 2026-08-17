import { GeoLocation } from '../../application/ports/IGpsService';

export interface StoredLocationRepository {
  getLastKnown(): Promise<GeoLocation | null>;
  save(loc: GeoLocation): Promise<void>;
}

export default StoredLocationRepository;
