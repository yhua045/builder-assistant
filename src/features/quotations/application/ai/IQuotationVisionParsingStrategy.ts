import { NormalizedQuotation } from './IQuotationParsingStrategy';

export type QuotationVisionStrategyType = 'llm-vision';

export interface IQuotationVisionParsingStrategy {
  readonly strategyType: QuotationVisionStrategyType;
  /** Parse the image at `imageUri` into a structured quotation. */
  parse(imageUri: string): Promise<NormalizedQuotation>;
}
