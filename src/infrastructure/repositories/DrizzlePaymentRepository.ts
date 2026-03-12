import { Payment } from '../../domain/entities/Payment';
import { PaymentRepository, PaymentFilters, PaymentListResult } from '../../domain/repositories/PaymentRepository';
import { initDatabase } from '../database/connection';

function isoToMillis(iso?: string) {
  return iso ? new Date(iso).getTime() : null;
}

function millisToIso(ms?: number | null) {
  return typeof ms === 'number' && !isNaN(ms) ? new Date(ms).toISOString() : undefined;
}

export class DrizzlePaymentRepository implements PaymentRepository {
  async save(payment: Payment): Promise<void> {
    const { db } = await initDatabase();
    const now = Date.now();
    const stmt = `INSERT INTO payments (
      id, project_id, invoice_id, amount, currency, payment_date, due_date, status, payment_method, reference, notes,
      contact_id, contractor_name, payment_category, stage_label,
      created_at, updated_at
    ) VALUES (${new Array(17).fill('?').join(',')})`;

    const params = [
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
      payment.contactId ?? null,
      payment.contractorName ?? null,
      payment.paymentCategory ?? 'other',
      payment.stageLabel ?? null,
      now,
      now,
    ];

    await db.executeSql(stmt, params);
  }

  private rowToPayment(row: any): Payment {
    return {
      id: row.id,
      projectId: row.project_id,
      invoiceId: row.invoice_id,
      amount: row.amount,
      currency: row.currency,
      date: millisToIso(row.payment_date),
      dueDate: millisToIso(row.due_date),
      status: row.status,
      method: row.payment_method,
      reference: row.reference,
      notes: row.notes,
      contactId: row.contact_id ?? undefined,
      contractorName: row.contractor_name ?? undefined,
      paymentCategory: row.payment_category ?? 'other',
      stageLabel: row.stage_label ?? undefined,
      createdAt: millisToIso(row.created_at),
      updatedAt: millisToIso(row.updated_at),
    } as Payment;
  }

  async findById(id: string): Promise<Payment | null> {
    const { db } = await initDatabase();
    const [res] = await db.executeSql('SELECT * FROM payments WHERE id = ? LIMIT 1', [id]);
    if (res.rows.length === 0) return null;
    return this.rowToPayment(res.rows.item(0));
  }

  async findAll(): Promise<Payment[]> {
    const { db } = await initDatabase();
    const [res] = await db.executeSql('SELECT * FROM payments ORDER BY created_at DESC');
    const items: Payment[] = [];
    for (let i = 0; i < res.rows.length; i++) {
      items.push(this.rowToPayment(res.rows.item(i)));
    }
    return items;
  }

  async findByProjectId(projectId: string): Promise<Payment[]> {
    const { db } = await initDatabase();
    const [res] = await db.executeSql('SELECT * FROM payments WHERE project_id = ? ORDER BY created_at DESC', [projectId]);
    const items: Payment[] = [];
    for (let i = 0; i < res.rows.length; i++) {
      items.push(this.rowToPayment(res.rows.item(i)));
    }
    return items;
  }

  async findByInvoice(invoiceId: string): Promise<Payment[]> {
    const { db } = await initDatabase();
    const [res] = await db.executeSql('SELECT * FROM payments WHERE invoice_id = ? ORDER BY created_at DESC', [invoiceId]);
    const items: Payment[] = [];
    for (let i = 0; i < res.rows.length; i++) {
      items.push(this.rowToPayment(res.rows.item(i)));
    }
    return items;
  }

  async findPendingByProject(projectId: string): Promise<Payment[]> {
    const { db } = await initDatabase();
    const [res] = await db.executeSql('SELECT * FROM payments WHERE project_id = ? AND status = \'pending\' ORDER BY created_at DESC', [projectId]);
    const items: Payment[] = [];
    for (let i = 0; i < res.rows.length; i++) {
      items.push(this.rowToPayment(res.rows.item(i)));
    }
    return items;
  }

  async update(payment: Payment): Promise<void> {
    const { db } = await initDatabase();
    const now = Date.now();
    await db.executeSql(
      `UPDATE payments SET project_id = ?, invoice_id = ?, amount = ?, currency = ?, payment_date = ?, due_date = ?, status = ?, payment_method = ?, reference = ?, notes = ?, contact_id = ?, contractor_name = ?, payment_category = ?, stage_label = ?, updated_at = ? WHERE id = ?`,
      [
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
        payment.contactId ?? null,
        payment.contractorName ?? null,
        payment.paymentCategory ?? 'other',
        payment.stageLabel ?? null,
        now,
        payment.id,
      ]
    );
  }

  async delete(id: string): Promise<void> {
    const { db } = await initDatabase();
    await db.executeSql('DELETE FROM payments WHERE id = ?', [id]);
  }

  // Basic list implementation (in-memory filtering for now).
  async list(filters: PaymentFilters): Promise<PaymentListResult> {
    const { db } = await initDatabase();

    const where: string[] = [];
    const params: any[] = [];

    // status
    if (filters?.status) {
      where.push('status = ?');
      params.push(filters.status);
    }

    // projectId — only applied when allProjects is not set
    if (filters?.projectId && !filters?.allProjects) {
      where.push('project_id = ?');
      params.push(filters.projectId);
    }

    // invoiceId
    if (filters?.invoiceId) {
      where.push('invoice_id = ?');
      params.push(filters.invoiceId);
    }

    // date range: compare against COALESCE(payment_date, due_date)
    if (filters?.fromDate) {
      where.push('(COALESCE(payment_date, due_date) >= ?)');
      params.push(new Date(filters.fromDate).getTime());
    }

    if (filters?.toDate) {
      where.push('(COALESCE(payment_date, due_date) <= ?)');
      params.push(new Date(filters.toDate).getTime());
    }

    // isOverdue: pending and due_date < now
    if (filters?.isOverdue) {
      where.push('status = ?');
      params.push('pending');
      where.push('(due_date IS NOT NULL AND due_date < ?)');
      params.push(Date.now());
    }

    // contractorSearch: case-insensitive partial match
    if (filters?.contractorSearch) {
      where.push('(contractor_name LIKE ? COLLATE NOCASE)');
      params.push(`%${filters.contractorSearch}%`);
    }

    // paymentCategory filter
    if (filters?.paymentCategory) {
      where.push('payment_category = ?');
      params.push(filters.paymentCategory);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Count total
    const countSql = `SELECT COUNT(*) as cnt FROM payments ${whereSql}`;
    const [countRes] = await db.executeSql(countSql, params);
    const total = countRes.rows.length ? (countRes.rows.item(0).cnt as number) : 0;

    // Urgency sort when querying global pending list
    const orderBy = filters?.allProjects
      ? `ORDER BY CASE WHEN (status = 'pending' AND due_date IS NOT NULL AND due_date < ${Date.now()}) THEN 0 ELSE 1 END, due_date ASC`
      : 'ORDER BY created_at DESC';

    // Fetch items with ordering and pagination
    let listSql = `SELECT * FROM payments ${whereSql} ${orderBy}`;
    if (typeof filters?.limit === 'number') {
      listSql += ' LIMIT ?';
      params.push(filters.limit);
      const offset = filters.offset ?? 0;
      listSql += ' OFFSET ?';
      params.push(offset);
    }

    const [res] = await db.executeSql(listSql, params);
    const items: Payment[] = [];
    for (let i = 0; i < res.rows.length; i++) {
      items.push(this.rowToPayment(res.rows.item(i)));
    }

    return { items, meta: { total, limit: filters?.limit, offset: filters?.offset } };
  }

  async getMetrics(projectId?: string): Promise<{ pendingTotalNext7Days: number; overdueCount: number }> {
    // Minimal implementation: compute from database queries.
    const now = Date.now();
    const in7d = now + 7 * 24 * 60 * 60 * 1000;

      const { db } = await initDatabase();
      const pendingParams: any[] = [in7d];
      let pendingSql = `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'pending' AND due_date IS NOT NULL AND due_date <= ?`;
      if (projectId) {
        pendingSql += ' AND project_id = ?';
        pendingParams.push(projectId);
      }
      const [pendingRes] = await db.executeSql(pendingSql, pendingParams);
      const pendingTotalNext7Days = pendingRes.rows.length ? (pendingRes.rows.item(0).total as number) : 0;

      const overdueParams: any[] = [now];
      let overdueSql = `SELECT COUNT(*) as cnt FROM payments WHERE status = 'pending' AND due_date IS NOT NULL AND due_date < ?`;
      if (projectId) {
        overdueSql += ' AND project_id = ?';
        overdueParams.push(projectId);
      }
      const [overdueRes] = await db.executeSql(overdueSql, overdueParams);
      const overdueCount = overdueRes.rows.length ? (overdueRes.rows.item(0).cnt as number) : 0;

      return { pendingTotalNext7Days, overdueCount };
  }

  async getGlobalAmountPayable(contractorSearch?: string): Promise<number> {
    const { db } = await initDatabase();
    const params: any[] = [];
    let sql = `SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE status = 'pending'`;
    if (contractorSearch) {
      sql += ' AND (contractor_name LIKE ? COLLATE NOCASE)';
      params.push(`%${contractorSearch}%`);
    }
    const [res] = await db.executeSql(sql, params);
    return res.rows.length ? (res.rows.item(0).total as number) : 0;
  }
}
