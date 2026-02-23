import {
  ILocationService,
  NearbySearchOptions,
  PropertyMatch,
} from '../../application/services/ILocationService';

/**
 * Remote location adapter — skeleton.
 *
 * Calls `GET /api/projects/nearby` when a server-side spatial endpoint is
 * available. Until then, every call throws `not_implemented` so that
 * `GetNearbyProjectsUseCase` falls back to `LocalLocationAdapter`.
 *
 * TODO: replace the throw with a real `fetch` call once the backend is ready.
 */
export class RemoteLocationAdapter implements ILocationService {
  async findNearbyProjects(
    _latitude: number,
    _longitude: number,
    _opts?: NearbySearchOptions,
  ): Promise<PropertyMatch[]> {
    throw new Error('not_implemented');
  }
}

export default RemoteLocationAdapter;
