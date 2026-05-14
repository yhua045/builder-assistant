import { NormalizedInvoice } from './IInvoiceNormalizer';

export interface InvoiceProcessorResult {
  normalized: NormalizedInvoice;
  rawOcrText: string;
}

export interface IInvoiceDocumentProcessor {
  /**
   * Given the local URI of a validated, copied file and its mimeType,
   * perform all OCR / vision steps and return a structured result.
   * Throws on processing error; returns empty result on graceful degradation.
   */
  process(localUri: string, mimeType: string): Promise<InvoiceProcessorResult>;
}
