import { QuotationParserFactory } from '../../application/ai/QuotationParserFactory';
import { LlmQuotationParser } from '../../infrastructure/ai/LlmQuotationParser';

describe('QuotationParserFactory', () => {
  it('creates an LlmQuotationParser when strategyType is "llm"', () => {
    const strategy = QuotationParserFactory.create({
      strategyType: 'llm',
      groqApiKey: 'test-key',
    });
    expect(strategy).toBeInstanceOf(LlmQuotationParser);
    expect(strategy.strategyType).toBe('llm');
  });

  it('throws when strategyType is "llm" but groqApiKey is missing', () => {
    expect(() =>
      QuotationParserFactory.create({ strategyType: 'llm' }),
    ).toThrow('groqApiKey is required for llm strategy');
  });

  it('throws when strategyType is "llm" and groqApiKey is empty string', () => {
    expect(() =>
      QuotationParserFactory.create({ strategyType: 'llm', groqApiKey: '' }),
    ).toThrow('groqApiKey is required for llm strategy');
  });

  it('throws for unsupported strategyType', () => {
    expect(() =>
      // @ts-expect-error testing unsupported value
      QuotationParserFactory.create({ strategyType: 'unknown' }),
    ).toThrow("unsupported strategyType 'unknown'");
  });
});
