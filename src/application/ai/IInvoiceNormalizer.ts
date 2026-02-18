import { OcrResult } from '../services/IOcrAdapter';

export interface InvoiceLineItemCandidate {
  description: string;
  quantity?: number;
  unitPrice?: number;
  total?: number;
  tax?: number;
}

export interface InvoiceCandidates {
  vendors: string[];         // Potential vendor/issuer names
  invoiceNumbers: string[];  // Potential invoice numbers
  dates: Date[];             // Potential invoice dates
  dueDates: Date[];          // Potential due dates
  amounts: number[];         // Potential totals
  subtotals: number[];       // Potential subtotals
  taxAmounts: number[];      // Potential tax amounts
  lineItems: InvoiceLineItemCandidate[];
}

export interface NormalizedInvoiceLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  tax?: number;
}

export interface NormalizedInvoice {
  vendor: string | null;
  invoiceNumber: string | null;
  invoiceDate: Date | null;
  dueDate: Date | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  currency: string;  // Default: "USD"
  lineItems: NormalizedInvoiceLineItem[];
  confidence: {
    overall: number;       // 0.0-1.0
    vendor: number;
    invoiceNumber: number;
    invoiceDate: number;
    total: number;
  };
  suggestedCorrections: string[];  // Human-readable suggestions for review
}

export interface IInvoiceNormalizer {
  /**
   * Extract structured invoice field candidates from raw OCR text.
   * This is a lightweight pre-processing step before normalization.
   * @param text - Raw OCR full text
   * @returns Structured candidates for further normalization
   */
  extractCandidates(text: string): InvoiceCandidates;

  /**
   * Normalize and improve OCR-extracted invoice candidates
   * @param candidates - Parsed invoice field candidates
   * @param ocrResult - Raw OCR result for context
   * @returns Normalized invoice with confidence scores
   */
  normalize(
    candidates: InvoiceCandidates,
    ocrResult: OcrResult
  ): Promise<NormalizedInvoice>;
}
