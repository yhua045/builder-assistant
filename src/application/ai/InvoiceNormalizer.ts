import { IInvoiceNormalizer, InvoiceCandidates, InvoiceLineItemCandidate, NormalizedInvoice, NormalizedInvoiceLineItem } from './IInvoiceNormalizer';
import { OcrResult } from '../services/IOcrAdapter';

/**
 * InvoiceNormalizer - Rules-based invoice field normalization
 * 
 * This implementation provides intelligent normalization using business rules:
 * - Vendor name cleanup (remove "Inc.", "LLC", "Ltd.", etc.)
 * - Date selection (prefer most recent within reasonable range)
 * - Amount validation (total must match line items when available)
 * - Tax validation (tax must be < total)
 * - Currency detection from symbols ($, €, £, ¥)
 * - Confidence scoring based on data quality
 * - Due date validation (must be >= invoice date)
 * 
 * Adapted from DeterministicReceiptNormalizer for invoice-specific fields.
 */
export class InvoiceNormalizer implements IInvoiceNormalizer {
  /**
   * Extract structured invoice field candidates from raw OCR text.
   * Uses lightweight regex patterns to identify potential field values.
   */
  extractCandidates(text: string): InvoiceCandidates {
    return {
      vendors: this.extractVendors(text),
      invoiceNumbers: this.extractInvoiceNumbers(text),
      dates: this.extractDates(text),
      dueDates: this.extractDueDates(text),
      amounts: this.extractAmounts(text),
      subtotals: this.extractSubtotals(text),
      taxAmounts: this.extractTaxAmounts(text),
      lineItems: this.extractLineItems(text),
    };
  }

  private extractVendors(text: string): string[] {
    const vendors: string[] = [];
    const lines = text.split('\n');

    // Heuristic: vendor name is often on the first 1-3 non-empty lines
    const candidates = lines.slice(0, 5).filter(l => l.trim().length > 2);
    for (const line of candidates) {
      const trimmed = line.trim();
      // Skip lines that are obviously not vendor names (all digits, URLs, email, etc.)
      if (
        /^\d/.test(trimmed) ||
        /^(invoice|bill|receipt|date|total|tax|due|subtotal)/i.test(trimmed) ||
        /@/.test(trimmed) ||
        /^https?:\/\//i.test(trimmed)
      ) {
        continue;
      }
      vendors.push(trimmed);
    }

    return [...new Set(vendors)];
  }

  private extractInvoiceNumbers(text: string): string[] {
    const numbers: string[] = [];

    // Common patterns: INV-001, Invoice #123, #INV2024-001, etc.
    const patterns = [
      /invoice\s*(?:no\.?|number|#)\s*([A-Z0-9][A-Z0-9\-_\/]{2,20})/gi,
      /inv(?:oice)?\s*[-#:]?\s*([A-Z0-9][A-Z0-9\-_\/]{2,20})/gi,
      /#\s*([A-Z0-9][A-Z0-9\-_\/]{2,20})/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1]) numbers.push(match[1].toUpperCase());
      }
    }

    return [...new Set(numbers)];
  }

  private extractDates(text: string): Date[] {
    const dates: Date[] = [];

    // Common date formats: MM/DD/YYYY, DD-MM-YYYY, Month DD YYYY, YYYY-MM-DD
    const patterns = [
      /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g,
      /\b(\d{4})-(\d{2})-(\d{2})\b/g,
      /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})\b/gi,
    ];

    // Avoid parsing due dates as plain dates
    const dueDateLine = /due\s*(?:date|by|on)?[:\s]+(.+)/gi;
    const dueDateMatches = new Set<string>();
    let m;
    while ((m = dueDateLine.exec(text)) !== null) {
      dueDateMatches.add(m[1].trim());
    }

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        try {
          const dateStr = match[0];
          // Skip if this text is part of a "due date" line
          const isInDueLine = [...dueDateMatches].some(d => d.includes(dateStr));
          if (isInDueLine) continue;
          const d = new Date(dateStr);
          if (!isNaN(d.getTime())) dates.push(d);
        } catch (_) {
          // ignore parse errors
        }
      }
    }

    return dates;
  }

  private extractDueDates(text: string): Date[] {
    const dueDates: Date[] = [];

    // Look for lines that mention "due" near a date
    const dueDatePattern = /due\s*(?:date|by|on)?[:\s]+([^\n]+)/gi;
    let match;
    while ((match = dueDatePattern.exec(text)) !== null) {
      const segment = match[1];
      // Try to parse a date from the segment
      const datePatterns = [
        /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/,
        /\b(\d{4})-(\d{2})-(\d{2})\b/,
        /\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})\b/i,
      ];
      for (const pat of datePatterns) {
        const dm = pat.exec(segment);
        if (dm) {
          try {
            const d = new Date(dm[0]);
            if (!isNaN(d.getTime())) dueDates.push(d);
          } catch (_) { /* ignore */ }
        }
      }
    }

    return dueDates;
  }

  private extractAmounts(text: string): number[] {
    const amounts: number[] = [];

    // Look for currency amounts near "total" keywords
    const totalPattern = /(?:total|amount\s+due|balance\s+due)[:\s]*\$?\s*([\d,]+\.?\d*)/gi;
    let match;
    while ((match = totalPattern.exec(text)) !== null) {
      const v = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(v) && v > 0) amounts.push(v);
    }

    // Also find all standalone dollar amounts
    const amountPattern = /\$\s*([\d,]+\.?\d{2})\b/g;
    while ((match = amountPattern.exec(text)) !== null) {
      const v = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(v) && v > 0) amounts.push(v);
    }

    return [...new Set(amounts)];
  }

  private extractSubtotals(text: string): number[] {
    const subtotals: number[] = [];
    const pattern = /subtotal[:\s]*\$?\s*([\d,]+\.?\d*)/gi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const v = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(v) && v > 0) subtotals.push(v);
    }
    return subtotals;
  }

  private extractTaxAmounts(text: string): number[] {
    const taxAmounts: number[] = [];
    const pattern = /(?:tax|gst|vat|hst)[:\s]*\$?\s*([\d,]+\.?\d*)/gi;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const v = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(v) && v > 0) taxAmounts.push(v);
    }
    return taxAmounts;
  }

  private extractLineItems(text: string): InvoiceLineItemCandidate[] {
    const lineItems: InvoiceLineItemCandidate[] = [];
    const lines = text.split('\n');

    // Heuristic: lines with a description followed by a dollar amount
    for (const line of lines) {
      const m = /^(.+?)\s+(\d+)\s*x\s*\$?([\d,]+\.?\d+)\s*=?\s*\$?([\d,]+\.?\d+)?$/i.exec(line.trim());
      if (m) {
        lineItems.push({
          description: m[1].trim(),
          quantity: parseInt(m[2], 10),
          unitPrice: parseFloat(m[3].replace(/,/g, '')),
          total: m[4] ? parseFloat(m[4].replace(/,/g, '')) : undefined,
        });
      }
    }

    return lineItems;
  }

  async normalize(
    candidates: InvoiceCandidates,
    ocrResult: OcrResult
  ): Promise<NormalizedInvoice> {
    // 1. Normalize Vendor
    const vendor = this.normalizeVendor(candidates.vendors);
    const vendorConfidence = this.calculateVendorConfidence(candidates.vendors);

    // 2. Normalize Invoice Number
    const invoiceNumber = this.normalizeInvoiceNumber(candidates.invoiceNumbers);
    const invoiceNumberConfidence = this.calculateInvoiceNumberConfidence(candidates.invoiceNumbers);

    // 3. Normalize Invoice Date
    const invoiceDate = this.normalizeDate(candidates.dates);
    const invoiceDateConfidence = this.calculateDateConfidence(candidates.dates);

    // 4. Normalize Line Items
    const lineItems = this.normalizeLineItems(candidates.lineItems);

    // 5. Normalize Total Amount
    const total = this.normalizeTotal(candidates.amounts, lineItems);
    const totalConfidence = this.calculateTotalConfidence(
      candidates.amounts,
      lineItems,
      total
    );

    // 6. Normalize Subtotal
    const subtotal = this.normalizeSubtotal(candidates.subtotals, lineItems);

    // 7. Normalize Tax
    const tax = this.normalizeTax(candidates.taxAmounts, total);

    // 8. Normalize Due Date (must be >= invoice date)
    const dueDate = this.normalizeDueDate(candidates.dueDates, invoiceDate);

    // 9. Detect Currency
    const currency = this.detectCurrency(ocrResult.fullText);

    // 10. Calculate Overall Confidence
    const overallConfidence = this.calculateOverallConfidence({
      vendor: vendorConfidence,
      invoiceNumber: invoiceNumberConfidence,
      invoiceDate: invoiceDateConfidence,
      total: totalConfidence,
    });

    // 11. Generate Suggestions
    const suggestedCorrections = this.generateSuggestions({
      vendor,
      vendorConfidence,
      invoiceNumber,
      invoiceDate,
      total,
      totalConfidence,
      overallConfidence,
    });

    return {
      vendor,
      invoiceNumber,
      invoiceDate,
      dueDate,
      subtotal,
      tax,
      total,
      currency,
      lineItems,
      confidence: {
        overall: overallConfidence,
        vendor: vendorConfidence,
        invoiceNumber: invoiceNumberConfidence,
        invoiceDate: invoiceDateConfidence,
        total: totalConfidence,
      },
      suggestedCorrections,
    };
  }

  private normalizeVendor(vendors: string[]): string | null {
    if (vendors.length === 0) return null;

    // Pick the longest vendor name (usually most complete)
    const longestVendor = vendors.reduce((longest, current) => 
      current.length > longest.length ? current : longest
    , vendors[0]);

    // Remove common legal suffixes
    const cleaned = longestVendor
      .replace(/\s+(Inc\.|LLC|Ltd\.|Corp\.|Co\.|L\.L\.C\.|Corporation|Limited)$/i, '')
      .trim();

    return cleaned || null;
  }

  private calculateVendorConfidence(vendors: string[]): number {
    if (vendors.length === 0) return 0.0;
    if (vendors.length === 1) return 0.9;

    // Check if all vendor names are similar (edit distance)
    const allSimilar = vendors.every(v => 
      vendors.every(other => this.isSimilar(v, other))
    );

    return allSimilar ? 0.85 : 0.5;
  }

  private normalizeInvoiceNumber(invoiceNumbers: string[]): string | null {
    if (invoiceNumbers.length === 0) return null;

    // Pick the longest invoice number (most likely to be complete)
    return invoiceNumbers.reduce((longest, current) => 
      current.length > longest.length ? current : longest
    , invoiceNumbers[0]);
  }

  private calculateInvoiceNumberConfidence(invoiceNumbers: string[]): number {
    if (invoiceNumbers.length === 0) return 0.0;
    if (invoiceNumbers.length === 1) return 0.9;
    
    // Check if invoice numbers are similar (e.g., "INV-2024-001" and "2024-001")
    const allSimilar = invoiceNumbers.every(num => 
      invoiceNumbers.every(other => this.isSimilar(num, other))
    );
    
    return allSimilar ? 0.8 : 0.4;
  }

  private normalizeDate(dates: Date[]): Date | null {
    if (dates.length === 0) return null;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

    // Filter dates within reasonable range (past 30 days to 60 days in future)
    const validDates = dates.filter(d => d >= thirtyDaysAgo && d <= sixtyDaysFromNow);

    if (validDates.length === 0) {
      // If no dates in valid range, pick the most recent one
      return dates.reduce((latest, current) => current > latest ? current : latest, dates[0]);
    }

    // For valid dates, prefer ones close to now (prefer past dates over future dates)
    // Sort by distance from now, prioritizing past dates
    const sortedByProximity = validDates.sort((a, b) => {
      const aInPast = a <= now;
      const bInPast = b <= now;
      
      // Prefer past dates over future dates
      if (aInPast && !bInPast) return -1;
      if (!aInPast && bInPast) return 1;
      
      // If both in same category (past or future), prefer closer to now
      return Math.abs(a.getTime() - now.getTime()) - Math.abs(b.getTime() - now.getTime());
    });

    return sortedByProximity[0];
  }

  private calculateDateConfidence(dates: Date[]): number {
    if (dates.length === 0) return 0.0;
    if (dates.length === 1) return 0.9;

    // Check if all dates are within 7 days of each other
    const minDate = dates.reduce((min, d) => d < min ? d : min, dates[0]);
    const maxDate = dates.reduce((max, d) => d > max ? d : max, dates[0]);
    const daysDiff = (maxDate.getTime() - minDate.getTime()) / (24 * 60 * 60 * 1000);

    return daysDiff <= 7 ? 0.8 : 0.4;
  }

  private normalizeDueDate(dueDates: Date[], invoiceDate: Date | null): Date | null {
    if (dueDates.length === 0) return null;

    // Filter due dates that are after invoice date
    if (invoiceDate) {
      const validDueDates = dueDates.filter(d => d >= invoiceDate);
      if (validDueDates.length > 0) {
        // Pick earliest valid due date
        return validDueDates.reduce((earliest, current) => 
          current < earliest ? current : earliest
        , validDueDates[0]);
      }
    }

    // If no invoice date or no valid due dates, pick the earliest one
    return dueDates.reduce((earliest, current) => 
      current < earliest ? current : earliest
    , dueDates[0]);
  }

  private normalizeLineItems(items: InvoiceCandidates['lineItems']): NormalizedInvoiceLineItem[] {
    return items.map(item => {
      const quantity = item.quantity || 1;
      const unitPrice = item.unitPrice || (item.total ? item.total / quantity : 0);
      const total = item.total || quantity * unitPrice;

      return {
        description: item.description,
        quantity,
        unitPrice,
        total,
        tax: item.tax,
      };
    });
  }

  private normalizeTotal(amounts: number[], lineItems: NormalizedInvoiceLineItem[]): number | null {
    if (amounts.length === 0) return null;

    // If we have line items, check which amount matches their sum
    if (lineItems.length > 0) {
      const lineItemsTotal = lineItems.reduce((sum, item) => sum + item.total, 0);
      
      // Find amount closest to line items total (within 10% tolerance)
      const matchingAmount = amounts.find(amt => {
        const diff = Math.abs(amt - lineItemsTotal);
        return diff / lineItemsTotal <= 0.1;
      });

      if (matchingAmount) return matchingAmount;
    }

    // Otherwise, pick the largest amount (most likely to be total)
    return Math.max(...amounts);
  }

  private normalizeSubtotal(subtotals: number[], lineItems: NormalizedInvoiceLineItem[]): number | null {
    if (lineItems.length > 0) {
      return lineItems.reduce((sum, item) => sum + item.total, 0);
    }

    if (subtotals.length === 0) return null;
    return subtotals[0];
  }

  private calculateTotalConfidence(
    amounts: number[],
    lineItems: NormalizedInvoiceLineItem[],
    total: number | null
  ): number {
    if (!total) return 0.0;
    if (amounts.length === 0) return 0.0;
    if (amounts.length === 1) return 0.9;

    // If we have line items and total matches, high confidence
    if (lineItems.length > 0) {
      const lineItemsTotal = lineItems.reduce((sum, item) => sum + item.total, 0);
      const diff = Math.abs(total - lineItemsTotal);
      if (diff / lineItemsTotal <= 0.1) return 0.95;
    }

    return 0.6;
  }

  private normalizeTax(taxAmounts: number[], total: number | null): number | null {
    if (taxAmounts.length === 0) return null;

    // Filter tax amounts that are less than total and reasonable (< 30% of total)
    const validTaxAmounts = taxAmounts.filter(tax => {
      if (!total) return true;
      return tax < total && (tax / total) < 0.3;
    });

    if (validTaxAmounts.length === 0) return null;

    // Pick the first valid tax amount
    return validTaxAmounts[0];
  }

  private detectCurrency(fullText: string): string {
    if (fullText.includes('€') || /EUR/i.test(fullText)) return 'EUR';
    if (fullText.includes('£') || /GBP/i.test(fullText)) return 'GBP';
    if (fullText.includes('¥') || /JPY/i.test(fullText)) return 'JPY';
    if (fullText.includes('$') || /USD/i.test(fullText)) return 'USD';
    if (/CAD/i.test(fullText)) return 'CAD';
    if (/AUD/i.test(fullText)) return 'AUD';
    
    return 'USD'; // Default
  }

  private calculateOverallConfidence(confidences: {
    vendor: number;
    invoiceNumber: number;
    invoiceDate: number;
    total: number;
  }): number {
    // Weight total and vendor more heavily
    const weighted = 
      confidences.vendor * 0.3 +
      confidences.invoiceNumber * 0.2 +
      confidences.invoiceDate * 0.2 +
      confidences.total * 0.3;

    return weighted;
  }

  private generateSuggestions(data: {
    vendor: string | null;
    vendorConfidence: number;
    invoiceNumber: string | null;
    invoiceDate: Date | null;
    total: number | null;
    totalConfidence: number;
    overallConfidence: number;
  }): string[] {
    const suggestions: string[] = [];

    if (!data.vendor || data.vendorConfidence < 0.5) {
      suggestions.push('Please verify vendor name');
    }

    if (!data.invoiceNumber) {
      suggestions.push('Invoice number not detected - please enter manually');
    }

    if (!data.invoiceDate) {
      suggestions.push('Invoice date not detected - please enter manually');
    }

    if (!data.total || data.totalConfidence < 0.5) {
      suggestions.push('Please verify total amount');
    }

    if (data.overallConfidence < 0.5) {
      suggestions.push('Low confidence extraction - please review all fields carefully');
    }

    return suggestions;
  }

  private isSimilar(str1: string, str2: string): boolean {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    // Simple similarity check: one contains the other or they share significant overlap
    if (s1.includes(s2) || s2.includes(s1)) return true;

    // Check if they share at least 70% of characters
    const commonChars = s1.split('').filter(c => s2.includes(c)).length;
    const similarity = commonChars / Math.max(s1.length, s2.length);

    return similarity >= 0.7;
  }
}
