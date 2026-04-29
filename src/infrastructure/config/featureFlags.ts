/**
 * Feature flags for issue #171 fast lookup entry.
 * Flip to `true` once the corresponding adapter/UI is production-ready.
 */
export const FeatureFlags = {
  /** Enable "Lookup by license" in QuickAddContractorModal */
  externalLookup: false,
  /** Enable admin CSV bulk import of contacts */
  csvImport: false,
  /**
   * When true, upload/camera flows skip local ML Kit OCR and send the raw
   * image directly to Groq's Vision model (llama-3.2-90b-vision-preview).
   * When false (default), the existing OCR → text-model pipeline is used.
   * Flip to `true` for quality/cost experimentation.
   */
  useVisionOcr: false,
} as const;
