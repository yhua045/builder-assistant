import {
  IQuotationParsingStrategy,
  QuotationParsingStrategyType,
} from './IQuotationParsingStrategy';
import { LlmQuotationParser } from '../../infrastructure/ai/LlmQuotationParser';

export interface QuotationParserConfig {
  strategyType: QuotationParsingStrategyType;
  /** Required when strategyType is 'llm' */
  groqApiKey?: string;
}

export class QuotationParserFactory {
  static create(config: QuotationParserConfig): IQuotationParsingStrategy {
    if (config.strategyType === 'llm') {
      if (!config.groqApiKey) {
        throw new Error(
          'QuotationParserFactory: groqApiKey is required for llm strategy',
        );
      }
      return new LlmQuotationParser(config.groqApiKey);
    }

    throw new Error(
      `QuotationParserFactory: unsupported strategyType '${config.strategyType}'`,
    );
  }
}
