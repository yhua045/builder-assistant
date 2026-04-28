import { Invoice } from '../../../domain/entities/Invoice';
import { Payment } from '../../../domain/entities/Payment';
import { ReceiptRepository } from '../domain/ReceiptRepository';
import { getDatabase } from '../../../infrastructure/database/connection';

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
      await db.executeSql('BEGIN TRANSACTION');

      try {
        console.log('[DrizzleReceiptRepository] transaction - inserting invoice', { invoiceId: invoice.id });
        await db.executeSql(
          `INSERT INTO invoices (
          id, project_id, external_id, external_reference,
          issuer_name, issuer_id, issuer_address, issuer_tax_id,
          recipient_name, recipient_id,
          total, subtotal, tax, currency,
          date_issued, date_due, payment_date,
          status, payment_status,
          document_id, line_items, tags, notes, metadata,
          created_at, updated_at
        ) VALUES (${new Array(26).fill('?').join(',')})`,
          [
            invoice.id,
            invoice.projectId ?? null,
            normalizeExternalKey(invoice.externalId),
            normalizeExternalKey(invoice.externalReference),
            invoice.issuerName ?? null,
            invoice.issuerId ?? null,
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
            isoToMillis(payment.dueDate),
            payment.status ?? null,
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

        // Update project total_payments aggregate
        if (invoice.projectId) {
          await db.executeSql(
            `UPDATE projects SET total_payments = total_payments + ?, updated_at = ? WHERE id = ?`,
            [invoice.total, now, invoice.projectId]
          );
        }

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
      throw err;
    }
  }

  async createUnpaidInvoice(invoice: Invoice): Promise<Invoice> {
    const { db } = getDatabase();
    const now = Date.now();

    console.log('[DrizzleReceiptRepository] createUnpaidInvoice - start', { invoiceId: invoice.id });
    try {
      await db.executeSql('BEGIN TRANSACTION');

      try {
        await db.executeSql(
          `INSERT INTO invoices (
          id, project_id, external_id, external_reference,
          issuer_name, issuer_id, issuer_address, issuer_tax_id,
          recipient_name, recipient_id,
          total, subtotal, tax, currency,
          date_issued, date_due, payment_date,
          status, payment_status,
          document_id, line_items, tags, notes, metadata,
          created_at, updated_at
        ) VALUES (${new Array(26).fill('?').join(',')})`,
          [
            invoice.id,
            invoice.projectId ?? null,
            normalizeExternalKey(invoice.externalId),
            normalizeExternalKey(invoice.externalReference),
            invoice.issuerName ?? null,
            invoice.issuerId ?? null,
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
            'issued',
            'unpaid',
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
          throw new Error('SIMULATE_FAIL');
        }

        // Update project pending_payments aggregate
        if (invoice.projectId) {
          await db.executeSql(
            `UPDATE projects SET pending_payments = pending_payments + ?, updated_at = ? WHERE id = ?`,
            [invoice.total, now, invoice.projectId]
          );
        }

        await db.executeSql('COMMIT');
      } catch (innerErr) {
        console.error('[DrizzleReceiptRepository] createUnpaidInvoice - rolling back', innerErr);
        await db.executeSql('ROLLBACK');
        throw innerErr;
      }

      console.log('[DrizzleReceiptRepository] createUnpaidInvoice - success', { invoiceId: invoice.id });
      return { ...invoice, status: 'issued', paymentStatus: 'unpaid' };
    } catch (err: any) {
      console.error('[DrizzleReceiptRepository] createUnpaidInvoice - ERROR', err?.message || err);
      throw err;
    }
  }
}

