import { Payment } from '../../domain/entities/Payment';
import { PaymentRepository } from '../../domain/repositories/PaymentRepository';
import { getDatabase } from '../database/connection';

function isoToMillis(iso?: string) {
  return iso ? new Date(iso).getTime() : null;
}

function millisToIso(ms?: number | null) {
  return typeof ms === 'number' && !isNaN(ms) ? new Date(ms).toISOString() : undefined;
}

export class DrizzlePaymentRepository implements PaymentRepository {
  async save(payment: Payment): Promise<void> {
    const { db } = getDatabase();
    const now = Date.now();
    const stmt = `INSERT INTO payments (
      id, project_id, invoice_id, amount, currency, payment_date, payment_method, reference, notes, created_at, updated_at
    ) VALUES (${new Array(11).fill('?').join(',')})`;

    const params = [
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
    ];

    await db.executeSql(stmt, params);
  }

  async findById(id: string): Promise<Payment | null> {
    const { db } = getDatabase();
    const [res] = await db.executeSql('SELECT * FROM payments WHERE id = ? LIMIT 1', [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows.item(0);
    return {
      id: row.id,
      projectId: row.project_id,
      invoiceId: row.invoice_id,
      amount: row.amount,
      currency: row.currency,
      date: millisToIso(row.payment_date),
      method: row.payment_method,
      reference: row.reference,
      notes: row.notes,
      createdAt: millisToIso(row.created_at),
      updatedAt: millisToIso(row.updated_at),
    } as Payment;
  }

  async findAll(): Promise<Payment[]> {
    const { db } = getDatabase();
    const [res] = await db.executeSql('SELECT * FROM payments ORDER BY created_at DESC');
    const items: Payment[] = [];
    for (let i = 0; i < res.rows.length; i++) {
      const row = res.rows.item(i);
      items.push(await this.findById(row.id) as Payment);
    }
    return items;
  }

  async findByProjectId(projectId: string): Promise<Payment[]> {
    const { db } = getDatabase();
    const [res] = await db.executeSql('SELECT * FROM payments WHERE project_id = ? ORDER BY created_at DESC', [projectId]);
    const items: Payment[] = [];
    for (let i = 0; i < res.rows.length; i++) {
      const row = res.rows.item(i);
      items.push(await this.findById(row.id) as Payment);
    }
    return items;
  }

  async findByInvoice(invoiceId: string): Promise<Payment[]> {
    const { db } = getDatabase();
    const [res] = await db.executeSql('SELECT * FROM payments WHERE invoice_id = ? ORDER BY created_at DESC', [invoiceId]);
    const items: Payment[] = [];
    for (let i = 0; i < res.rows.length; i++) {
      const row = res.rows.item(i);
      items.push(await this.findById(row.id) as Payment);
    }
    return items;
  }

  async findPendingByProject(projectId: string): Promise<Payment[]> {
    const { db } = getDatabase();
    const [res] = await db.executeSql('SELECT * FROM payments WHERE project_id = ? AND (notes IS NULL OR notes = "") ORDER BY created_at DESC', [projectId]);
    const items: Payment[] = [];
    for (let i = 0; i < res.rows.length; i++) {
      const row = res.rows.item(i);
      items.push(await this.findById(row.id) as Payment);
    }
    return items;
  }

  async update(payment: Payment): Promise<void> {
    const { db } = getDatabase();
    const now = Date.now();
    await db.executeSql(
      `UPDATE payments SET project_id = ?, invoice_id = ?, amount = ?, currency = ?, payment_date = ?, payment_method = ?, reference = ?, notes = ?, updated_at = ? WHERE id = ?`,
      [
        payment.projectId ?? null,
        payment.invoiceId ?? null,
        payment.amount,
        payment.currency ?? null,
        isoToMillis(payment.date),
        payment.method ?? null,
        payment.reference ?? null,
        payment.notes ?? null,
        now,
        payment.id,
      ]
    );
  }

  async delete(id: string): Promise<void> {
    const { db } = getDatabase();
    await db.executeSql('DELETE FROM payments WHERE id = ?', [id]);
  }
}
