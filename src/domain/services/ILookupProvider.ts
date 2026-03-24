// src/domain/services/ILookupProvider.ts
// Domain port for external contractor/builder registry lookups (issue #171).
// A NullLookupProvider (ships by default) and real adapters can slot in here.

export interface LookupResult {
  licenseNumber: string;
  name: string;
  trade?: string;
  phone?: string;
  address?: string;
  /** e.g. 'VBA' | 'NSW_FAIR_TRADING' */
  source: string;
}

export interface ILookupProvider {
  /** Run a search query against an external registry. */
  search(query: string): Promise<LookupResult[]>;
  /** Returns false when no external registry is configured. */
  isAvailable(): boolean;
}
