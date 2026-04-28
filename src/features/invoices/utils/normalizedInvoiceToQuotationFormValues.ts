import { Quotation, QuotationLineItem } from '../../../domain/entities/Quotation';
import { NormalizedInvoice, NormalizedInvoiceLineItem } from '../application/IInvoiceNormalizer';

/**
 * Maps a NormalizedInvoice (from OCR + AI normalization) to the
 * subset of Quotation fields accepted as `initialValues` by QuotationForm.
 *
 * Rules:
 * - null/undefined normalized fields are omitted (let QuotationForm defaults apply)
 * - Dates are converted to ISO strings as expected by QuotationForm state
 * - lineItems are converted from NormalizedInvoiceLineItem → QuotationLineItem
 * - reference is omitted when invoiceNumber is null (domain auto-generates when blank)
 * - currency is always mapped
 */
export function normalizedInvoiceToQuotationFormValues(
  normalized: NormalizedInvoice,
): Partial<Quotation> {
  const values: Partial<Quotation> = {};

  if (normalized.vendor != null) {
    values.vendorName = normalized.vendor;
  }

  if (normalized.invoiceNumber != null) {
    values.reference = normalized.invoiceNumber;
  }

  if (normalized.invoiceDate != null) {
    values.date = normalized.invoiceDate.toISOString();
  }

  if (normalized.dueDate != null) {
    values.expiryDate = normalized.dueDate.toISOString();
  }

  if (normalized.total != null) {
    values.total = normalized.total;
  }

  // currency always has a default value in NormalizedInvoice
  values.currency = normalized.currency;

  if (normalized.lineItems.length > 0) {
    values.lineItems = normalized.lineItems.map(
      (item: NormalizedInvoiceLineItem): QuotationLineItem => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
        tax: item.tax,
      }),
    );
  }

  return values;
}
