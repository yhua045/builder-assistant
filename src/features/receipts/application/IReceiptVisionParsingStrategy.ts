import { NormalizedReceipt } from './IReceiptNormalizer';

export type ReceiptVisionStrategyType = 'llm-vision';

export interface IReceiptVisionParsingStrategy {
  readonly strategyType: ReceiptVisionStrategyType;
  /** Parse the image at `imageUri` into a structured receipt. */
  parse(imageUri: string): Promise<NormalizedReceipt>;
}
