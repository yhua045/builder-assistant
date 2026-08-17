/**
 * Port: ILocationService
 *
 * Application-layer interface for querying nearby project properties given
 * GPS coordinates. Implementations live in src/infrastructure/location/.
 */

export type NearbySearchOptions = {
  /** Search radius in kilometres. Default: 5 */
  radiusKm?: number;
  /** Maximum number of results to return. Default: 10 */
  maxResults?: number;
  /** Minimum composite ranking score (0..1). Results below this are excluded. */
  minConfidence?: number;
  /** Primary sort key. Default: 'distance' */
  sortBy?: 'distance' | 'relevance' | 'recentActivity';
};

export type PropertyMatch = {
  projectId: string;
  propertyId?: string | null;
  address: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  /** Normalised composite score 0..1 (higher = better match). */
  rankingScore: number;
  /** Human-readable explanation, e.g. "very close", "recent activity". */
  reason?: string;
};

export interface ILocationService {
  /**
   * Returns a ranked list of projects whose associated property lies within
   * `opts.radiusKm` of the given coordinates.
   */
  findNearbyProjects(
    latitude: number,
    longitude: number,
    opts?: NearbySearchOptions,
  ): Promise<PropertyMatch[]>;

  /**
   * Optional pure helper — Haversine great-circle distance in metres.
   * Exposed so callers can compute distances without instantiating a full use
   * case.
   */
  computeDistanceMeters?(
    latA: number,
    lonA: number,
    latB: number,
    lonB: number,
  ): number;
}

export default ILocationService;
