export type GeoLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  altitude?: number | null;
  timestamp: string; // ISO 8601
};

export type GetLocationOptions = {
  timeoutMs?: number;
  maxAgeMs?: number;
  requiredAccuracyMeters?: number;
};

export interface IGpsService {
  getBestLocation(options?: GetLocationOptions): Promise<GeoLocation | null>;
  getLastKnownLocation(): GeoLocation | null;
  persistLastKnownLocation(loc: GeoLocation): Promise<void>;
}

export default IGpsService;
