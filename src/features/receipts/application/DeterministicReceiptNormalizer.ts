import { IReceiptNormalizer, NormalizedReceipt } from './IReceiptNormalizer';
import { ReceiptCandidates } from './ReceiptFieldParser';
import { OcrResult } from '../../../application/services/IOcrAdapter';

/**
 * DeterministicReceiptNormalizer - Rules-based receipt field normalization
 * 
 * This implementation provides intelligent normalization using business rules:
 * - Vendor name cleanup (remove "Inc.", "LLC", "Ltd.", etc.)
 * - Date selection (prefer most recent within last 30 days)
 * - Amount validation (total must be >= sum of line items)
 * - Tax validation (tax must be < total)
 * - Currency detection from symbols ($, €, £, ¥)
 * - Confidence scoring based on data quality
 * 
 * Ready for production use with deterministic, testable logic.
 */
export class DeterministicReceiptNormalizer implements IReceiptNormalizer {
  async normalize(
    candidates: ReceiptCandidates,
    ocrResult: OcrResult
  ): Promise<NormalizedReceipt> {
    // 1. Normalize Vendor
    const vendor = this.normalizeVendor(candidates.vendors);
    const vendorConfidence = this.calculateVendorConfidence(candidates.vendors);

    // 2. Normalize Date
    const date = this.normalizeDate(candidates.dates);
    const dateConfidence = this.calculateDateConfidence(candidates.dates);

    // 3. Normalize Total Amount
    const total = this.normalizeTotal(candidates.amounts, candidates.lineItems);
    const totalConfidence = this.calculateTotalConfidence(
      candidates.amounts,
      candidates.lineItems,
      total
    );

    // 4. Normalize Tax
    const tax = this.normalizeTax(candidates.taxAmounts, total);

    // 5. Detect Currency
    const currency = this.detectCurrency(ocrResult.fullText);

    // 6. Normalize Receipt Number
    const receiptNumber = candidates.receiptNumbers.length > 0
      ? candidates.receiptNumbers[0]
      : null;

    // 7. Normalize Line Items
    const lineItems = candidates.lineItems.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total,
      category: undefined  // No AI categorization in deterministic version
    }));

    // 8. Calculate Overall Confidence
    const overallConfidence = (vendorConfidence + dateConfidence + totalConfidence) / 3;

    // 9. Generate Suggested Corrections
    const suggestedCorrections = this.generateSuggestions(
      vendor,
      date,
      total,
      tax,
      candidates,
      overallConfidence
    );

    return {
      vendor,
      date,
      total,
      subtotal: null,
      tax,
      currency,
      paymentMethod: null,
      receiptNumber,
      lineItems,
      notes: null,
      confidence: {
        overall: overallConfidence,
        vendor: vendorConfidence,
        date: dateConfidence,
        total: totalConfidence
      },
      suggestedCorrections
    };
  }

  private normalizeVendor(vendors: string[]): string | null {
    if (vendors.length === 0) return null;

    // Pick first candidate and clean it
    let vendor = vendors[0];

    // Remove common business suffixes
    const suffixes = [
      'Inc.', 'Inc', 'LLC', 'Ltd.', 'Ltd', 'Corporation', 'Corp.', 'Corp',
      'Limited', 'Co.', 'Company', 'L.L.C.', 'L.P.', 'LLP'
    ];

    for (const suffix of suffixes) {
      const regex = new RegExp(`\\s+${suffix}\\s*$`, 'i');
      vendor = vendor.replace(regex, '');
    }

    return vendor.trim();
  }

  private calculateVendorConfidence(vendors: string[]): number {
    if (vendors.length === 0) return 0.0;
    if (vendors.length === 1) return 0.9;  // Single clear vendor
    if (vendors.length === 2) return 0.7;  // Couple options
    return 0.5;  // Multiple vendors, less certain
  }

  private normalizeDate(dates: Date[]): Date | null {
    if (dates.length === 0) return null;

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Filter dates within last 30 days
    const recentDates = dates.filter(d => d >= thirtyDaysAgo && d <= now);

    if (recentDates.length > 0) {
      // Pick most recent date
      return recentDates.reduce((latest, current) =>
        current > latest ? current : latest
      );
    }

    // If no recent dates, pick the latest one anyway
    return dates.reduce((latest, current) =>
      current > latest ? current : latest
    );
  }

  private calculateDateConfidence(dates: Date[]): number {
    if (dates.length === 0) return 0.0;

    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentDates = dates.filter(d => d >= thirtyDaysAgo && d <= now);

    if (recentDates.length === 1) return 0.9;  // Single recent date
    if (recentDates.length > 1) return 0.7;   // Multiple recent dates
    return 0.5;  // No recent dates
  }

  private normalizeTotal(amounts: number[], lineItems: ReceiptCandidates['lineItems']): number | null {
    if (amounts.length === 0) return null;

    const lineItemsSum = lineItems.reduce((sum, item) => sum + item.total, 0);

    if (lineItemsSum > 0) {
      // Find amount >= line items sum (most likely to be total)
      const validAmounts = amounts.filter(a => a >= lineItemsSum);
      if (validAmounts.length > 0) {
        // Pick smallest valid amount (closest to line items sum)
        return Math.min(...validAmounts);
      }
    }

    // Fallback: pick largest amount as likely total
    return Math.max(...amounts);
  }

  private calculateTotalConfidence(
    amounts: number[],
    lineItems: ReceiptCandidates['lineItems'],
    total: number | null
  ): number {
    if (!total) return 0.0;
    if (amounts.length === 0) return 0.0;

    const lineItemsSum = lineItems.reduce((sum, item) => sum + item.total, 0);

    if (lineItemsSum > 0 && total >= lineItemsSum) {
      // Total is validated against line items
      const diff = total - lineItemsSum;
      if (diff < lineItemsSum * 0.2) {
        // Tax/fees < 20% of subtotal seems reasonable
        return 0.9;
      }
      return 0.7;
    }

    if (amounts.length === 1) return 0.8;  // Single amount found
    if (amounts.length <= 3) return 0.6;   // Few amounts
    return 0.4;  // Many amounts, unclear which is total
  }

  private normalizeTax(taxAmounts: number[], total: number | null): number | null {
    if (taxAmounts.length === 0) return null;
    if (!total) return taxAmounts[0];  // No validation possible

    // Filter tax amounts that are < total
    const validTaxes = taxAmounts.filter(t => t < total);

    if (validTaxes.length > 0) {
      // Pick first valid tax
      return validTaxes[0];
    }

    return null;  // No valid tax found
  }

  private detectCurrency(fullText: string): string {
    // Check for currency symbols
    if (fullText.includes('€')) return 'EUR';
    if (fullText.includes('£')) return 'GBP';
    if (fullText.includes('¥')) return 'JPY';
    if (fullText.includes('A$') || fullText.includes('AUD')) return 'AUD';
    if (fullText.includes('C$') || fullText.includes('CAD')) return 'CAD';

    // Default to USD
    return 'USD';
  }

  private generateSuggestions(
    vendor: string | null,
    date: Date | null,
    total: number | null,
    tax: number | null,
    candidates: ReceiptCandidates,
    overallConfidence: number
  ): string[] {
    const suggestions: string[] = [];

    if (!vendor) {
      suggestions.push('Vendor name not detected - please enter manually');
    } else if (candidates.vendors.length > 2) {
      suggestions.push('Multiple vendor names found - please verify');
    }

    if (!date) {
      suggestions.push('Date not found - please enter receipt date');
    } else if (candidates.dates.length > 3) {
      suggestions.push('Multiple dates found - please verify receipt date');
    }

    if (!total) {
      suggestions.push('Total amount unclear - please verify');
    } else if (candidates.amounts.length > 5) {
      suggestions.push('Many amounts detected - please verify total');
    }

    if (tax && total && tax > total * 0.3) {
      suggestions.push('Tax amount seems high - please verify');
    }

    if (overallConfidence < 0.5) {
      suggestions.push('Low OCR quality - please review all fields carefully');
    }

    return suggestions;
  }
}
