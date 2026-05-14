import { NormalizedInvoice } from './IInvoiceNormalizer';

export type InvoiceVisionStrategyType = 'llm-vision';

export interface IInvoiceVisionParsingStrategy {
  readonly strategyType: InvoiceVisionStrategyType;
  /** Parse the image at `imageUri` into a structured invoice. */
  parse(imageUri: string): Promise<NormalizedInvoice>;
}
