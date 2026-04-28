import { Quotation, QuotationLineItem } from '../../../domain/entities/Quotation';
import {
  NormalizedQuotation,
  NormalizedQuotationLineItem,
} from '../application/ai/IQuotationParsingStrategy';

/**
 * Maps a NormalizedQuotation (from the LLM/regex parsing strategy) to the
 * subset of Quotation fields accepted as `initialValues` by QuotationForm.
 *
 * Rules:
 * - null/undefined normalized fields are omitted (let QuotationForm defaults apply)
 * - Dates are converted to ISO strings as expected by QuotationForm state
 * - lineItems are converted from NormalizedQuotationLineItem → QuotationLineItem
 * - currency is always mapped (NormalizedQuotation always has a default)
 */
export function normalizedQuotationToFormValues(
  normalized: NormalizedQuotation,
): Partial<Quotation> {
  const values: Partial<Quotation> = {};

  if (normalized.vendor != null) {
    values.vendorName = normalized.vendor;
  }

  if (normalized.reference != null) {
    values.reference = normalized.reference;
  }

  if (normalized.date != null) {
    values.date = normalized.date.toISOString();
  }

  if (normalized.expiryDate != null) {
    values.expiryDate = normalized.expiryDate.toISOString();
  }

  if (normalized.total != null) {
    values.total = normalized.total;
  }

  if (normalized.subtotal != null) {
    values.subtotal = normalized.subtotal;
  }

  if (normalized.tax != null) {
    values.taxTotal = normalized.tax;
  }

  if (normalized.vendorEmail != null) {
    values.vendorEmail = normalized.vendorEmail;
  }

  if (normalized.vendorAddress != null) {
    values.vendorAddress = normalized.vendorAddress;
  }

  if (normalized.notes != null) {
    values.notes = normalized.notes;
  }

  // currency always has a default value in NormalizedQuotation
  values.currency = normalized.currency;

  if (normalized.lineItems.length > 0) {
    values.lineItems = normalized.lineItems.map(
      (item: NormalizedQuotationLineItem): QuotationLineItem => ({
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
