import { Invoice, InvoiceLineItem } from '../domain/entities/Invoice';
import { NormalizedInvoice, NormalizedInvoiceLineItem } from '../application/ai/IInvoiceNormalizer';

/**
 * Maps a NormalizedInvoice (from OCR + AI normalization) to the
 * subset of Invoice fields accepted as `initialValues` by InvoiceForm.
 *
 * Rules:
 * - null/undefined normalized fields are omitted (let InvoiceForm defaults apply)
 * - Dates are converted to ISO strings as expected by InvoiceForm state
 * - lineItems are converted from NormalizedInvoiceLineItem → InvoiceLineItem
 */
export function normalizedInvoiceToFormValues(
  normalized: NormalizedInvoice,
): Partial<Invoice> {
  const values: Partial<Invoice> = {};

  if (normalized.vendor != null) {
    values.issuerName = normalized.vendor;
  }

  if (normalized.invoiceNumber != null) {
    values.externalReference = normalized.invoiceNumber;
  }

  if (normalized.invoiceDate != null) {
    values.dateIssued = normalized.invoiceDate.toISOString();
  }

  if (normalized.dueDate != null) {
    values.dateDue = normalized.dueDate.toISOString();
  }

  if (normalized.total != null) {
    values.total = normalized.total;
  }

  if (normalized.subtotal != null) {
    values.subtotal = normalized.subtotal;
  }

  if (normalized.tax != null) {
    values.tax = normalized.tax;
  }

  // currency always has a default value ("USD") in NormalizedInvoice
  values.currency = normalized.currency;

  if (normalized.lineItems.length > 0) {
    values.lineItems = normalized.lineItems.map(
      (item: NormalizedInvoiceLineItem): InvoiceLineItem => ({
        description: item.description,
        quantity: item.quantity,
        unitCost: item.unitPrice,
        total: item.total,
        tax: item.tax,
      }),
    );
  }

  return values;
}
