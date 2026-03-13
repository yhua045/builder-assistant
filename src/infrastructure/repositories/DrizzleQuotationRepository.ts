import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { eq } from 'drizzle-orm';
import { Quotation } from '../../domain/entities/Quotation';
import {
  QuotationRepository,
  QuotationFilterParams,
} from '../../domain/repositories/QuotationRepository';
import { initDatabase } from '../database/connection';
import { quotations } from '../database/schema';

export class DrizzleQuotationRepository implements QuotationRepository {
  private db: ReturnType<typeof drizzle> | null = null;

  private parseJson<T>(value: string | null | undefined, fallback: T): T {
    if (!value) return fallback;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  private async getDb() {
    if (!this.db) {
      const { drizzle: dbDrizzle } = await initDatabase();
      this.db = dbDrizzle;
    }
    return this.db!;
  }

  private async getSqlDb() {
    const { db } = await initDatabase();
    return db;
  }

  private mapToEntity(row: typeof quotations.$inferSelect): Quotation {
    const r = row as any;
    return {
      id: r.id ?? r.id,
      reference: r.reference ?? r.reference,

      projectId: (r.projectId ?? r.project_id) || undefined,
      taskId: (r.taskId ?? r.task_id) || undefined,
      documentId: (r.documentId ?? r.document_id) || undefined,
      vendorId: (r.vendorId ?? r.vendor_id) || undefined,
      contactId: (r.vendorId ?? r.vendor_id) || undefined, // Alias

      vendorName: (r.vendorName ?? r.vendor_name) || undefined,
      vendorAddress: (r.vendorAddress ?? r.vendor_address) || undefined,
      vendorEmail: (r.vendorEmail ?? r.vendor_email) || undefined,

      date: this.toIsoDate(r.date ?? r.date),
      expiryDate: (r.expiryDate ?? r.expiry_date)
        ? this.toIsoDate(r.expiryDate ?? r.expiry_date)
        : undefined,

      currency: r.currency || 'USD',
      subtotal: (r.subtotal ?? r.subtotal) || undefined,
      taxTotal: (r.taxTotal ?? r.tax_total) || undefined,
      total: r.total,

      lineItems: this.parseJson(r.lineItems ?? r.line_items, undefined),
      notes: (r.notes ?? r.notes) || undefined,

      status: (r.status ?? r.status) as Quotation['status'],

      createdAt: this.toIsoDate(r.createdAt ?? r.created_at),
      updatedAt: this.toIsoDate(r.updatedAt ?? r.updated_at),
      deletedAt: (r.deletedAt ?? r.deleted_at)
        ? this.toIsoDate(r.deletedAt ?? r.deleted_at)
        : undefined,
    };
  }

  private toIsoDate(value: number | string | null | undefined): string {
    const ms = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(ms)) {
      return new Date(0).toISOString();
    }
    return new Date(ms).toISOString();
  }

  async createQuotation(quotation: Quotation): Promise<Quotation> {
    const db = await this.getDb();
    const now = new Date().getTime();

    await db.insert(quotations).values({
      id: quotation.id,
      reference: quotation.reference,
      projectId: quotation.projectId,
      taskId: quotation.taskId,
      documentId: quotation.documentId,
      vendorId: quotation.vendorId || quotation.contactId, // Support both fields
      vendorName: quotation.vendorName,
      vendorAddress: quotation.vendorAddress,
      vendorEmail: quotation.vendorEmail,
      date: new Date(quotation.date).getTime(),
      expiryDate: quotation.expiryDate
        ? new Date(quotation.expiryDate).getTime()
        : null,
      currency: quotation.currency,
      subtotal: quotation.subtotal,
      taxTotal: quotation.taxTotal,
      total: quotation.total,
      lineItems: quotation.lineItems ? JSON.stringify(quotation.lineItems) : null,
      notes: quotation.notes,
      status: quotation.status,
      createdAt: now,
      updatedAt: now,
    });

    return quotation;
  }

  async getQuotation(id: string): Promise<Quotation | null> {
    const db = await this.getSqlDb();
    const [result] = await db.executeSql('SELECT * FROM quotations WHERE id = ?', [id]);
    if (result.rows.length === 0) return null;
    return this.mapToEntity(result.rows.item(0) as any);
  }

  async updateQuotation(
    id: string,
    updates: Partial<Quotation>
  ): Promise<Quotation> {
    const db = await this.getDb();
    const now = new Date().getTime();

    // Prepare update object
    const updateData: Partial<typeof quotations.$inferInsert> = {
      updatedAt: now,
    };

    if (updates.reference !== undefined) updateData.reference = updates.reference;
    if (updates.projectId !== undefined) updateData.projectId = updates.projectId;
    if (updates.taskId !== undefined) updateData.taskId = updates.taskId;
    if (updates.documentId !== undefined) updateData.documentId = updates.documentId;
    if (updates.vendorId !== undefined) updateData.vendorId = updates.vendorId;
    if (updates.contactId !== undefined) updateData.vendorId = updates.contactId; // Map contactId to vendorId
    if (updates.vendorName !== undefined) updateData.vendorName = updates.vendorName;
    if (updates.vendorAddress !== undefined)
      updateData.vendorAddress = updates.vendorAddress;
    if (updates.vendorEmail !== undefined)
      updateData.vendorEmail = updates.vendorEmail;
    if (updates.date !== undefined)
      updateData.date = new Date(updates.date).getTime();
    if (updates.expiryDate !== undefined)
      updateData.expiryDate = updates.expiryDate
        ? new Date(updates.expiryDate).getTime()
        : null;
    if (updates.currency !== undefined) updateData.currency = updates.currency;
    if (updates.subtotal !== undefined) updateData.subtotal = updates.subtotal;
    if (updates.taxTotal !== undefined) updateData.taxTotal = updates.taxTotal;
    if (updates.total !== undefined) updateData.total = updates.total;
    if (updates.lineItems !== undefined)
      updateData.lineItems = updates.lineItems
        ? JSON.stringify(updates.lineItems)
        : null;
    if (updates.notes !== undefined) updateData.notes = updates.notes;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.deletedAt !== undefined)
      updateData.deletedAt = updates.deletedAt
        ? new Date(updates.deletedAt).getTime()
        : null;

    await db.update(quotations).set(updateData).where(eq(quotations.id, id));

    const updated = await this.getQuotation(id);
    if (!updated) throw new Error(`Quotation not found after update: ${id}`);
    return updated;
  }

  async deleteQuotation(id: string): Promise<void> {
    const db = await this.getDb();
    // Soft delete
    const now = new Date().getTime();
    await db
      .update(quotations)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(quotations.id, id));
  }

  async findByReference(reference: string): Promise<Quotation | null> {
    const db = await this.getSqlDb();
    const [result] = await db.executeSql(
      'SELECT * FROM quotations WHERE reference = ? AND deleted_at IS NULL',
      [reference]
    );
    if (result.rows.length === 0) return null;
    return this.mapToEntity(result.rows.item(0) as any);
  }

  async findByTask(taskId: string): Promise<Quotation[]> {
    const db = await this.getSqlDb();
    const [result] = await db.executeSql(
      'SELECT * FROM quotations WHERE task_id = ? AND deleted_at IS NULL ORDER BY created_at DESC',
      [taskId],
    );
    const items: Quotation[] = [];
    for (let i = 0; i < result.rows.length; i++) {
      items.push(this.mapToEntity(result.rows.item(i) as any));
    }
    return items;
  }

  async listQuotations(
    params?: QuotationFilterParams
  ): Promise<{ items: Quotation[]; total: number }> {
    const db = await this.getSqlDb();

    const where: string[] = ['deleted_at IS NULL'];
    const args: any[] = [];

    if (params) {
      if (params.projectId) {
        where.push('project_id = ?');
        args.push(params.projectId);
      }
      if (params.vendorId) {
        where.push('vendor_id = ?');
        args.push(params.vendorId);
      }
      if (params.status && params.status.length > 0) {
        where.push(`status IN (${params.status.map(() => '?').join(', ')})`);
        args.push(...params.status);
      }
      if (params.dateRange) {
        const start = new Date(params.dateRange.start).getTime();
        const end = new Date(params.dateRange.end).getTime();
        where.push('date >= ? AND date <= ?');
        args.push(start, end);
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;

    const [rows] = await db.executeSql(
      `SELECT * FROM quotations ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...args, limit, offset]
    );

    const items: Quotation[] = [];
    for (let i = 0; i < rows.rows.length; i++) {
      items.push(this.mapToEntity(rows.rows.item(i) as any));
    }

    const [countRows] = await db.executeSql(
      `SELECT COUNT(*) as count FROM quotations ${whereSql}`,
      args
    );
    const total = countRows.rows.length ? countRows.rows.item(0).count : 0;

    return { items, total };
  }
}
