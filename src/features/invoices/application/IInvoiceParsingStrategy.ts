import { OcrResult } from '../../../application/services/IOcrAdapter';
import { NormalizedInvoice } from './IInvoiceNormalizer';

export type InvoiceParsingStrategyType = 'llm';

export interface IInvoiceParsingStrategy {
  readonly strategyType: InvoiceParsingStrategyType;
  parse(ocrResult: OcrResult): Promise<NormalizedInvoice>;
}
