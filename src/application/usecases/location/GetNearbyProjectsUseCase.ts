import {
  ILocationService,
  NearbySearchOptions,
  PropertyMatch,
} from '../../services/ILocationService';

/**
 * Minimal port for network availability. Implementations live in
 * infrastructure/network/ — or a simple `NetInfo` wrapper.
 */
export interface NetworkStatusProvider {
  isOnline(): boolean;
}

/**
 * Use Case: GetNearbyProjectsUseCase
 *
 * Orchestrates which location adapter to use based on network state and the
 * `remoteEnabled` feature flag:
 *
 *  - remoteEnabled = false (default)  → always use LocalLocationAdapter; the
 *      remote adapter is never instantiated, avoiding a try/catch for an
 *      expected `not_implemented` throw.
 *  - remoteEnabled = true + online     → try RemoteLocationAdapter, fall back
 *      to local on any error.
 *  - remoteEnabled = true + offline    → LocalLocationAdapter directly.
 *
 * Post-processes results by applying `minConfidence` filter and `maxResults`
 * cap so callers receive a clean, bounded list regardless of adapter.
 */
export class GetNearbyProjectsUseCase {
  constructor(
    private readonly local: ILocationService,
    private readonly remote: ILocationService,
    private readonly network: NetworkStatusProvider,
    private readonly remoteEnabled: boolean = false,
  ) {}

  async execute(
    latitude: number,
    longitude: number,
    opts: NearbySearchOptions = {},
  ): Promise<PropertyMatch[]> {
    let results: PropertyMatch[];

    if (this.remoteEnabled && this.network.isOnline()) {
      try {
        results = await this.remote.findNearbyProjects(latitude, longitude, opts);
      } catch {
        // Remote unavailable — fall back to local cache
        results = await this.local.findNearbyProjects(latitude, longitude, opts);
      }
    } else {
      results = await this.local.findNearbyProjects(latitude, longitude, opts);
    }

    // Post-process: minConfidence filter
    if (opts.minConfidence != null) {
      results = results.filter((r) => r.rankingScore >= (opts.minConfidence as number));
    }

    // Post-process: maxResults cap
    if (opts.maxResults != null) {
      results = results.slice(0, opts.maxResults);
    }

    return results;
  }
}

export default GetNearbyProjectsUseCase;
