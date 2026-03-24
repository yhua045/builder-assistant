/**
 * Feature flags for issue #171 fast lookup entry.
 * Flip to `true` once the corresponding adapter/UI is production-ready.
 */
export const FeatureFlags = {
  /** Enable "Lookup by license" in QuickAddContractorModal */
  externalLookup: false,
  /** Enable admin CSV bulk import of contacts */
  csvImport: false,
} as const;
