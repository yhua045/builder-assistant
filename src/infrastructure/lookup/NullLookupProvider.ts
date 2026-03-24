import { ILookupProvider, LookupResult } from '../../domain/services/ILookupProvider';

/**
 * Default no-op provider shipped until a real registry adapter is configured.
 * Registered via DI as 'LookupProvider'.
 */
export class NullLookupProvider implements ILookupProvider {
  isAvailable(): boolean {
    return false;
  }

  async search(_query: string): Promise<LookupResult[]> {
    return [];
  }
}
