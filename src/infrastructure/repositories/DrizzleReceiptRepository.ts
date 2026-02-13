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
      // Use manual transaction handling via executeSql because db.transaction 
      // does not support async/await callbacks correctly in react-native-sqlite-storage
      await db.executeSql('BEGIN TRANSACTION');

      try {
        console.log('[DrizzleReceiptRepository] transaction - inserting invoice', { invoiceId: invoice.id });
        await db.executeSql(
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
        if (invoice.metadata && (invoice.metadata as any).simulateFailure) {
          console.log('[DrizzleReceiptRepository] simulate failure requested - throwing');
          throw new Error('SIMULATE_FAIL');
        }

        console.log('[DrizzleReceiptRepository] transaction - inserting payment', { paymentId: payment.id });
        const paymentValues = [
            payment.id,
            payment.projectId ?? null,
            payment.invoiceId ?? null,
            payment.amount,
            payment.currency ?? null,
            isoToMillis(payment.date),
            isoToMillis(payment.dueDate), // New column
            payment.status ?? null,       // New column
            payment.method ?? null,
            payment.reference ?? null,
            payment.notes ?? null,
            now,
            now,
          ];
          
        await db.executeSql(
          `INSERT INTO payments (
          id, project_id, invoice_id, amount, currency, payment_date,
          due_date, status,
          payment_method, reference, notes, created_at, updated_at
        ) VALUES (${new Array(13).fill('?').join(',')})`,
          paymentValues
        );
        console.log('[DrizzleReceiptRepository] transaction - inserts completed');
      
        await db.executeSql('COMMIT');
      } catch (innerErr) {
        console.error('[DrizzleReceiptRepository] Transaction failed - rolling back', innerErr);
        await db.executeSql('ROLLBACK');
        throw innerErr;
      }

      console.log('[DrizzleReceiptRepository] createReceipt - success', { invoiceId: invoice.id, paymentId: payment.id });
      return { invoice, payment };
    } catch (err: any) {
      console.error('[DrizzleReceiptRepository] createReceipt - ERROR', err?.message || err, { invoiceId: invoice.id, paymentId: payment.id });
      // rethrow so callers can handle rollback semantics and surface errors
      throw err;
    }
  }
}
