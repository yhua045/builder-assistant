import { Invoice } from '../../domain/entities/Invoice';
import { Payment } from '../../domain/entities/Payment';
import { ReceiptRepository } from '../../domain/repositories/ReceiptRepository';
import { getDatabase } from '../database/connection';

function isoToMillis(iso?: string) {
  return iso ? new Date(iso).getTime() : null;
}

function normalizeExternalKey(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export class DrizzleReceiptRepository implements ReceiptRepository {
  async createReceipt(invoice: Invoice, payment: Payment): Promise<{ invoice: Invoice; payment: Payment }> {
    const { db } = getDatabase();
    const now = Date.now();

    console.log('[DrizzleReceiptRepository] createReceipt - start', { invoiceId: invoice.id, paymentId: payment.id });
    try {
      await db.transaction(async (tx: any) => {
        console.log('[DrizzleReceiptRepository] transaction - inserting invoice', { invoiceId: invoice.id });
        await tx.executeSql(
          `INSERT INTO invoices (
          id, project_id, external_id, external_reference,
          issuer_name, issuer_address, issuer_tax_id,
          recipient_name, recipient_id,
          total, subtotal, tax, currency,
          date_issued, date_due, payment_date,
          status, payment_status,
          document_id, line_items, tags, notes, metadata,
          created_at, updated_at
        ) VALUES (${new Array(25).fill('?').join(',')})`,
          [
            invoice.id,
            invoice.projectId ?? null,
            normalizeExternalKey(invoice.externalId),
            normalizeExternalKey(invoice.externalReference),
            invoice.issuerName ?? null,
            invoice.issuerAddress ?? null,
            invoice.issuerTaxId ?? null,
            invoice.recipientName ?? null,
            invoice.recipientId ?? null,
            invoice.total,
            invoice.subtotal ?? null,
            invoice.tax ?? null,
            invoice.currency,
            isoToMillis(invoice.dateIssued),
            isoToMillis(invoice.dateDue),
            isoToMillis(invoice.paymentDate),
            invoice.status,
            invoice.paymentStatus,
            invoice.documentId ?? null,
            invoice.lineItems ? JSON.stringify(invoice.lineItems) : null,
            invoice.tags ? JSON.stringify(invoice.tags) : null,
            invoice.notes ?? null,
            invoice.metadata ? JSON.stringify(invoice.metadata) : null,
            now,
            now,
          ]
        );

        // TEST HOOK: allow tests to simulate a failure after the invoice insert
        // by setting `metadata.simulateFailure = true` on the invoice object.
        // This makes it possible to assert that the transaction rolls back.
        if (invoice.metadata && (invoice.metadata as any).simulateFailure) {
          console.log('[DrizzleReceiptRepository] simulate failure requested - throwing');
          throw new Error('SIMULATE_FAIL');
        }

        console.log('[DrizzleReceiptRepository] transaction - inserting payment', { paymentId: payment.id });
        await tx.executeSql(
          `INSERT INTO payments (
          id, project_id, invoice_id, amount, currency, payment_date,
          payment_method, reference, notes, created_at, updated_at
        ) VALUES (${new Array(11).fill('?').join(',')})`,
          [
            payment.id,
            payment.projectId ?? null,
            payment.invoiceId ?? null,
            payment.amount,
            payment.currency ?? null,
            isoToMillis(payment.date),
            payment.method ?? null,
            payment.reference ?? null,
            payment.notes ?? null,
            now,
            now,
          ]
        );
        console.log('[DrizzleReceiptRepository] transaction - inserts completed');
      });

      console.log('[DrizzleReceiptRepository] createReceipt - success', { invoiceId: invoice.id, paymentId: payment.id });
      return { invoice, payment };
    } catch (err: any) {
      console.error('[DrizzleReceiptRepository] createReceipt - ERROR', err?.message || err, { invoiceId: invoice.id, paymentId: payment.id });
      // rethrow so callers can handle rollback semantics and surface errors
      throw err;
    }
  }
}
