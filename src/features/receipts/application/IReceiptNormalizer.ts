import { ReceiptCandidates } from './ReceiptFieldParser';
import { OcrResult } from '../../../application/services/IOcrAdapter';

export interface NormalizedLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category?: string;  // Optional: AI-suggested category (e.g., "Materials", "Labor")
}

export interface NormalizedReceipt {
  vendor: string | null;
  date: Date | null;
  total: number | null;
  subtotal: number | null;
  tax: number | null;
  currency: string;            // Default: "AUD"
  paymentMethod: 'card' | 'cash' | 'bank' | 'other' | null;
  receiptNumber: string | null;
  lineItems: NormalizedLineItem[];
  notes: string | null;
  confidence: {
    overall: number;           // 0.0-1.0
    vendor: number;
    date: number;
    total: number;
  };
  suggestedCorrections: string[];  // Human-readable suggestions for review
}

export interface IReceiptNormalizer {
  /**
   * Normalize and improve OCR-extracted candidates
   * @param candidates - Output from ReceiptFieldParser
   * @param ocrResult - Raw OCR result for context
   * @returns Normalized receipt with confidence scores
   */
  normalize(
    candidates: ReceiptCandidates,
    ocrResult: OcrResult
  ): Promise<NormalizedReceipt>;
}
