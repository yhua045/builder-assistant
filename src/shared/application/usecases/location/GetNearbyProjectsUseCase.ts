import {
  ILocationService,
  NearbySearchOptions,
  PropertyMatch,
} from '../../../../shared/application/ports/ILocationService';

export interface NetworkStatusProvider {
  isOnline(): boolean;
}

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
        results = await this.local.findNearbyProjects(latitude, longitude, opts);
      }
    } else {
      results = await this.local.findNearbyProjects(latitude, longitude, opts);
    }

    if (opts.minConfidence != null) {
      results = results.filter((r) => r.rankingScore >= (opts.minConfidence as number));
    }

    if (opts.maxResults != null) {
      results = results.slice(0, opts.maxResults);
    }

    return results;
  }
}

export default GetNearbyProjectsUseCase;
