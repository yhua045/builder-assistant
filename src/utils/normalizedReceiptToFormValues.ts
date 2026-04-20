import { NormalizedReceipt } from '../application/receipt/IReceiptNormalizer';
import { SnapReceiptDTO, ReceiptLineItemDTO } from '../application/usecases/receipt/SnapReceiptUseCase';

/**
 * Maps a NormalizedReceipt (from LLM parsing strategy) to the subset of
 * SnapReceiptDTO fields accepted as `initialValues` by ReceiptForm.
 *
 * Rules:
 * - null/undefined normalized fields are omitted (let ReceiptForm defaults apply)
 * - Dates are converted to ISO strings as expected by ReceiptForm state
 * - lineItems are mapped from NormalizedLineItem → ReceiptLineItemDTO
 * - currency is always mapped (NormalizedReceipt always has a default)
 */
export function normalizedReceiptToFormValues(
  normalized: NormalizedReceipt,
): Partial<SnapReceiptDTO> {
  const values: Partial<SnapReceiptDTO> = {};

  if (normalized.vendor != null) {
    values.vendor = normalized.vendor;
  }

  if (normalized.total != null) {
    values.amount = normalized.total;
  }

  if (normalized.date != null) {
    values.date = normalized.date.toISOString();
  }

  if (normalized.paymentMethod != null) {
    values.paymentMethod = normalized.paymentMethod;
  }

  // currency always has a default value in NormalizedReceipt
  values.currency = normalized.currency;

  if (normalized.notes != null) {
    values.notes = normalized.notes;
  }

  if (normalized.lineItems.length > 0) {
    values.lineItems = normalized.lineItems.map(
      (item): ReceiptLineItemDTO => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      }),
    );
  }

  return values;
}
