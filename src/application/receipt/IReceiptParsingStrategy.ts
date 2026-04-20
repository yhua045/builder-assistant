import { OcrResult } from '../services/IOcrAdapter';
import { NormalizedReceipt } from './IReceiptNormalizer';

export type ReceiptParsingStrategyType = 'llm';

export interface IReceiptParsingStrategy {
  readonly strategyType: ReceiptParsingStrategyType;
  parse(ocrResult: OcrResult): Promise<NormalizedReceipt>;
}
