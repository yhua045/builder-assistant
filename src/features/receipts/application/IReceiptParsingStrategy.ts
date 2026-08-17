import { OcrResult } from '../../../shared/application/ports/IOcrAdapter';
import { NormalizedReceipt } from './IReceiptNormalizer';

export type ReceiptParsingStrategyType = 'llm';

export interface IReceiptParsingStrategy {
  readonly strategyType: ReceiptParsingStrategyType;
  parse(ocrResult: OcrResult): Promise<NormalizedReceipt>;
}
