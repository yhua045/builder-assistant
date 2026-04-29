import { NormalizedReceipt } from './IReceiptNormalizer';

export interface ReceiptProcessorResult {
  normalized: NormalizedReceipt;
  rawOcrText: string;
}

export interface IReceiptDocumentProcessor {
  process(localUri: string, mimeType: string): Promise<ReceiptProcessorResult>;
}
