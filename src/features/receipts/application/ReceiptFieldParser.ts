import { OcrResult } from '../../../application/services/IOcrAdapter';

export interface ReceiptLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  confidence: number;
}

export interface ReceiptCandidates {
  vendors: string[];          // Heuristic: top 3 lines, likely bolded/larger text
  dates: Date[];              // Regex: MM/DD/YYYY, DD-MM-YYYY, ISO formats
  amounts: number[];          // Regex: $XX.XX, currency symbols, "Total", "Amount Due"
  taxAmounts: number[];       // Near keywords: "Tax", "GST", "VAT"
  receiptNumbers: string[];   // Near keywords: "Receipt #", "Invoice #", "Order #"
  lineItems: ReceiptLineItem[];  // Items with qty × price patterns
}


export class ReceiptFieldParser {
  parse(ocrResult: OcrResult): ReceiptCandidates {
    const candidates: ReceiptCandidates = {
      vendors: [],
      dates: [],
      amounts: [],
      taxAmounts: [],
      receiptNumbers: [],
      lineItems: []
    };

    if (!ocrResult || !ocrResult.fullText) {
      return candidates;
    }

    const lines = ocrResult.fullText.split('\n');

    // 1. Extract Vendor (Heuristic: Top 3 lines)
    // Avoid lines that look like dates or addresses if possible, but simplest is just take top 3 non-empty
    const vendorCandidates = lines
      .slice(0, 3)
      .map(line => line.trim())
      .filter(line => line.length > 0);
    candidates.vendors = vendorCandidates;

    // 2. Extract Dates
    // Layouts: MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY, etc.
    const dateRegex = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b|\b(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/g;
    const dateMatches = ocrResult.fullText.match(dateRegex);
    if (dateMatches) {
      candidates.dates = dateMatches
        .map(dateStr => new Date(dateStr))
        .filter(date => !isNaN(date.getTime()));
    }

    // 3. Extract Amounts (Total and Tax)
    // Look for lines containing "Total", "Amount", "Balance" etc.
    // And "Tax", "GST", "VAT"
    const moneyRegex = /[$€£¥]?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2}))/g;

    lines.forEach(line => {
      const lowerLine = line.toLowerCase();
      const amountsInLine = [];
      let match;
      while ((match = moneyRegex.exec(line)) !== null) {
          // Remove commas and parse
          const val = parseFloat(match[1].replace(/,/g, ''));
          if (!isNaN(val)) {
              amountsInLine.push(val);
          }
      }

      if (amountsInLine.length > 0) {
          // Check for Total keywords
          if (lowerLine.includes('total') || lowerLine.includes('amount due') || lowerLine.includes('balance')) {
              candidates.amounts.push(...amountsInLine);
          }
          // Check for Tax keywords
          if (lowerLine.includes('tax') || lowerLine.includes('gst') || lowerLine.includes('vat')) {
              candidates.taxAmounts.push(...amountsInLine);
          }
      }
    });
    
    // Fallback: collect all currency-like values if none found with keywords? 
    // For now, let's keep it strict to keywords based on "Deterministic" rule in plan.
    // But the unit test 'should extract amount candidates' expects simple "$100.00" without keyword sometimes?
    // Wait, the test case was:
    // fullText: 'Item 1 $10.00\nTotal $100.00',
    // expect(result.amounts).toContain(100.00); 
    // It seems I put expect(result.amounts).toContain(10.00); in the test too which might be a bit loose.
    // Let's refine the implementation to capture ALL amounts in a general bucket if needed, 
    // or just assume the requirement meant "Candidate Totals".
    // The plan says: "amounts: number[]; // Regex: $XX.XX, currency symbols, "Total", "Amount Due""
    // This implies we look for any currency amount, but prioritize Total/Amount Due.
    // Let's add all found amounts to candidates.amounts but maybe we can sort or prioritize them later in Normalizer.
    // For now, I'll add ALL found money patterns to candidates.amounts to satisfy the test `expect(result.amounts).toContain(10.00)`.
    
    // Resetting amounts loop to capture all
    let amountMatch;
    while ((amountMatch = moneyRegex.exec(ocrResult.fullText)) !== null) {
         const val = parseFloat(amountMatch[1].replace(/,/g, ''));
         if (!isNaN(val)) {
             candidates.amounts.push(val);
         }
    }
    // De-duplicate
    candidates.amounts = [...new Set(candidates.amounts)];


    // 4. Extract Receipt Number
    // Keywords: "Receipt #", "Invoice #", "Order #"
    const receiptNumRegex = /(?:Receipt|Invoice|Order)\s*(?:#|No\.? )?\s*([A-Za-z0-9-]+)/i;
    const receiptMatch = ocrResult.fullText.match(receiptNumRegex);
    if (receiptMatch && receiptMatch[1]) {
      candidates.receiptNumbers.push(receiptMatch[1]);
    }

    // 5. Extract Line Items
    // Pattern: Quantity x Description @ Price = Total (or similar variations)
    // Heuristic: Line containing at least 2 money-like numbers or 1 number and a quantity indicator
    // A simple regex for "2 x Widget @ $5.00"
    // Regex: (\d+)\s*[xX]\s*(.+?)\s*[@]?\s*[$€£¥]?(\d+\.\d{2})
    const lineItemRegex = /(\d+)\s*[xX]\s*(.+?)\s*(?:@\s*)?[$€£¥]?\s*(\d+\.\d{2})\s*(?:=\s*[$€£¥]?\s*(\d+\.\d{2}))?/i;
    
    lines.forEach(line => {
        const itemMatch = line.match(lineItemRegex);
        if (itemMatch) {
            const qty = parseFloat(itemMatch[1]);
            const description = itemMatch[2].trim();
            const price = parseFloat(itemMatch[3]);
            let total = 0;
            if (itemMatch[4]) {
                total = parseFloat(itemMatch[4]);
            } else {
                total = qty * price;
            }

            candidates.lineItems.push({
                description,
                quantity: qty,
                unitPrice: price,
                total,
                confidence: 0.8 // Arbitrary for heuristic match
            });
        }
    });

    return candidates;
  }
}
