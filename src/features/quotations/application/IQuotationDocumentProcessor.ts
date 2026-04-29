import { NormalizedQuotation } from './ai/IQuotationParsingStrategy';

export interface QuotationProcessorResult {
  normalized: NormalizedQuotation;
  rawOcrText: string;
}

export interface IQuotationDocumentProcessor {
  process(localUri: string, mimeType: string): Promise<QuotationProcessorResult>;
}
