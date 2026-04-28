import { OcrResult } from '../../../../application/services/IOcrAdapter';

export interface NormalizedQuotationLineItem {
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  total: number;
  tax?: number;
}

export interface NormalizedQuotation {
  reference: string | null;
  vendor: string | null;
  vendorEmail: string | null;
  vendorPhone: string | null;
  vendorAddress: string | null;
  taxId: string | null;
  date: Date | null;
  expiryDate: Date | null;
  currency: string; // Default: 'AUD'
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  lineItems: NormalizedQuotationLineItem[];
  paymentTerms: string | null;
  scope: string | null;
  exclusions: string | null;
  notes: string | null;
  confidence: {
    overall: number;
    vendor: number;
    reference: number;
    date: number;
    total: number;
  };
  suggestedCorrections: string[];
}

export type QuotationParsingStrategyType = 'regex' | 'llm';

export interface IQuotationParsingStrategy {
  readonly strategyType: QuotationParsingStrategyType;
  parse(ocrResult: OcrResult): Promise<NormalizedQuotation>;
}
