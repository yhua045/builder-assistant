import { IReceiptNormalizer, NormalizedReceipt } from './IReceiptNormalizer';
import { ReceiptCandidates } from './ReceiptFieldParser';
import { OcrResult } from '../../../application/services/IOcrAdapter';

/**
 * NoOpReceiptNormalizer - A stub/placeholder normalizer
 * 
 * This implementation provides basic pass-through normalization by:
 * - Picking first candidate for each field
 * - Setting low confidence scores
 * - Providing minimal validation
 * 
 * Purpose: Allows pipeline integration without blocking on AI implementation.
 * Can be swapped with DeterministicReceiptNormalizer or ML-based normalizer later.
 * 
 * Feature Flag: Enable/disable via runtime configuration
 */
export class NoOpReceiptNormalizer implements IReceiptNormalizer {
  async normalize(
    candidates: ReceiptCandidates,
    _ocrResult: OcrResult
  ): Promise<NormalizedReceipt> {
    // Simple strategy: pick first candidate for each field
    const vendor = candidates.vendors.length > 0 ? candidates.vendors[0] : null;
    const date = candidates.dates.length > 0 ? candidates.dates[0] : null;
    const total = candidates.amounts.length > 0 
      ? Math.max(...candidates.amounts)  // Pick largest amount as likely total
      : null;
    const tax = candidates.taxAmounts.length > 0 ? candidates.taxAmounts[0] : null;
    const receiptNumber = candidates.receiptNumbers.length > 0 
      ? candidates.receiptNumbers[0] 
      : null;

    // Pass through line items as-is
    const lineItems = candidates.lineItems.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
      category: undefined  // No AI categorization in stub
    }));

    // Low confidence since no real normalization/validation
    const confidence = {
      overall: 0.5,
      vendor: vendor ? 0.5 : 0.0,
      date: date ? 0.5 : 0.0,
      total: total ? 0.5 : 0.0
    };

    const suggestedCorrections: string[] = [];
    if (!vendor) suggestedCorrections.push('Vendor not detected');
    if (!date) suggestedCorrections.push('Date not found');
    if (!total) suggestedCorrections.push('Total amount unclear');

    return {
      vendor,
      date,
      total,
      subtotal: null,
      tax,
      currency: 'AUD',
      paymentMethod: null,
      receiptNumber,
      lineItems,
      notes: null,
      confidence,
      suggestedCorrections
    };
  }
}
