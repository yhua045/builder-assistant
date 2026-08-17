import { OcrResult } from '../../../shared/application/ports/IOcrAdapter';
import { NormalizedInvoice } from './IInvoiceNormalizer';

export type InvoiceParsingStrategyType = 'llm';

export interface IInvoiceParsingStrategy {
  readonly strategyType: InvoiceParsingStrategyType;
  parse(ocrResult: OcrResult): Promise<NormalizedInvoice>;
}
