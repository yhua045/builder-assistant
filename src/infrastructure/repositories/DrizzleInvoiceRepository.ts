import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { eq } from 'drizzle-orm';
import { Invoice } from '../../domain/entities/Invoice';
import { InvoiceRepository, InvoiceFilterParams } from '../../domain/repositories/InvoiceRepository';
import { initDatabase } from '../database/connection';
import { invoices } from '../database/schema';

export class DrizzleInvoiceRepository implements InvoiceRepository {
    private db: ReturnType<typeof drizzle> | null = null;

    private parseJson<T>(value: string | null | undefined, fallback: T): T {
        if (!value) return fallback;
        try {
            return JSON.parse(value) as T;
        } catch {
            return fallback;
        }
    }

    private normalizeExternalKey(value: string | null | undefined): string | null {
        if (value === undefined || value === null) return null;
        const trimmed = value.trim();
        return trimmed.length ? trimmed : null;
    }
    
    private async getDb() {
        if (!this.db) {
            const { drizzle } = await initDatabase();
            this.db = drizzle;
        }
        return this.db!;
    }

    private async getSqlDb() {
        const { db } = await initDatabase();
        return db;
    }

    private mapToEntity(row: typeof invoices.$inferSelect): Invoice {
        const r = row as any;
        return {
            id: r.id ?? r.id,
            projectId: (r.projectId ?? r.project_id) || undefined,
            
            externalId: (r.externalId ?? r.external_id) || undefined,
            externalReference: (r.externalReference ?? r.external_reference) || undefined,
            
            issuerName: (r.issuerName ?? r.issuer_name) || undefined,
            issuerAddress: (r.issuerAddress ?? r.issuer_address) || undefined,
            issuerTaxId: (r.issuerTaxId ?? r.issuer_tax_id) || undefined,
            recipientName: (r.recipientName ?? r.recipient_name) || undefined,
            recipientId: (r.recipientId ?? r.recipient_id) || undefined,
            
            total: r.total,
            subtotal: (r.subtotal ?? r.subtotal) || undefined,
            tax: (r.tax ?? r.tax) || undefined,
            currency: r.currency,
            
            status: (r.status ?? r.status) as Invoice['status'],
            paymentStatus: ((r.paymentStatus ?? r.payment_status) as Invoice['paymentStatus']) || 'unpaid',
            
            dateIssued: (r.dateIssued ?? r.date_issued) ? new Date(r.dateIssued ?? r.date_issued).toISOString() : undefined,
            dateDue: (r.dateDue ?? r.date_due) ? new Date(r.dateDue ?? r.date_due).toISOString() : undefined,
            paymentDate: (r.paymentDate ?? r.payment_date) ? new Date(r.paymentDate ?? r.payment_date).toISOString() : undefined,
            
            documentId: (r.documentId ?? r.document_id) || undefined,
            lineItems: this.parseJson(r.lineItems ?? r.line_items, undefined),
            tags: this.parseJson(r.tags ?? r.tags, undefined),
            notes: (r.notes ?? r.notes) || undefined,
            metadata: this.parseJson(r.metadata ?? r.metadata, undefined),
            
            createdAt: this.toIsoDate(r.createdAt ?? r.created_at),
            updatedAt: this.toIsoDate(r.updatedAt ?? r.updated_at),
            deletedAt: (r.deletedAt ?? r.deleted_at) ? this.toIsoDate(r.deletedAt ?? r.deleted_at) : undefined,
        };
    }

    private toIsoDate(value: number | string | null | undefined): string {
        const ms = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(ms)) {
            return new Date(0).toISOString();
        }
        return new Date(ms).toISOString();
    }

    async createInvoice(invoice: Invoice): Promise<Invoice> {
        const db = await this.getDb();
        const now = new Date().getTime();
        
        await db.insert(invoices).values({
            id: invoice.id,
            projectId: invoice.projectId,
            externalId: this.normalizeExternalKey(invoice.externalId),
            externalReference: this.normalizeExternalKey(invoice.externalReference),
            issuerName: invoice.issuerName,
            issuerAddress: invoice.issuerAddress,
            issuerTaxId: invoice.issuerTaxId,
            recipientName: invoice.recipientName,
            recipientId: invoice.recipientId,
            total: invoice.total,
            subtotal: invoice.subtotal,
            tax: invoice.tax,
            currency: invoice.currency,
            status: invoice.status,
            paymentStatus: invoice.paymentStatus,
            dateIssued: invoice.dateIssued ? new Date(invoice.dateIssued).getTime() : null,
            dateDue: invoice.dateDue ? new Date(invoice.dateDue).getTime() : null,
            paymentDate: invoice.paymentDate ? new Date(invoice.paymentDate).getTime() : null,
            documentId: invoice.documentId,
            lineItems: invoice.lineItems ? JSON.stringify(invoice.lineItems) : null,
            tags: invoice.tags ? JSON.stringify(invoice.tags) : null,
            notes: invoice.notes,
            metadata: invoice.metadata ? JSON.stringify(invoice.metadata) : null,
            createdAt: now,
            updatedAt: now,
        });
        
        return invoice;
    }

    async getInvoice(id: string): Promise<Invoice | null> {
        const db = await this.getSqlDb();
        const [result] = await db.executeSql('SELECT * FROM invoices WHERE id = ?', [id]);
        if (result.rows.length === 0) return null;
        return this.mapToEntity(result.rows.item(0) as any);
    }

    async updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice> {
        const db = await this.getDb();
        const now = new Date().getTime();
        
        // Prepare update object
        const updateData: Partial<typeof invoices.$inferInsert> = {
            updatedAt: now,
        };
        
        if (updates.projectId !== undefined) updateData.projectId = updates.projectId;
        if (updates.externalId !== undefined) updateData.externalId = this.normalizeExternalKey(updates.externalId);
        if (updates.externalReference !== undefined) updateData.externalReference = this.normalizeExternalKey(updates.externalReference);
        if (updates.issuerName !== undefined) updateData.issuerName = updates.issuerName;
        if (updates.issuerAddress !== undefined) updateData.issuerAddress = updates.issuerAddress;
        if (updates.issuerTaxId !== undefined) updateData.issuerTaxId = updates.issuerTaxId;
        if (updates.recipientName !== undefined) updateData.recipientName = updates.recipientName;
        if (updates.recipientId !== undefined) updateData.recipientId = updates.recipientId;
        if (updates.total !== undefined) updateData.total = updates.total;
        if (updates.subtotal !== undefined) updateData.subtotal = updates.subtotal;
        if (updates.tax !== undefined) updateData.tax = updates.tax;
        if (updates.currency !== undefined) updateData.currency = updates.currency;
        if (updates.status !== undefined) updateData.status = updates.status;
        if (updates.paymentStatus !== undefined) updateData.paymentStatus = updates.paymentStatus;
        if (updates.dateIssued !== undefined) updateData.dateIssued = updates.dateIssued ? new Date(updates.dateIssued).getTime() : null;
        if (updates.dateDue !== undefined) updateData.dateDue = updates.dateDue ? new Date(updates.dateDue).getTime() : null;
        if (updates.paymentDate !== undefined) updateData.paymentDate = updates.paymentDate ? new Date(updates.paymentDate).getTime() : null;
        if (updates.documentId !== undefined) updateData.documentId = updates.documentId;
        if (updates.lineItems !== undefined) updateData.lineItems = updates.lineItems ? JSON.stringify(updates.lineItems) : null;
        if (updates.tags !== undefined) updateData.tags = updates.tags ? JSON.stringify(updates.tags) : null;
        if (updates.notes !== undefined) updateData.notes = updates.notes;
        if (updates.metadata !== undefined) updateData.metadata = updates.metadata ? JSON.stringify(updates.metadata) : null;
        if (updates.deletedAt !== undefined) updateData.deletedAt = updates.deletedAt ? new Date(updates.deletedAt).getTime() : null;

        await db.update(invoices).set(updateData).where(eq(invoices.id, id));
        
        const updated = await this.getInvoice(id);
        if (!updated) throw new Error(`Invoice not found after update: ${id}`);
        return updated;
    }

    async deleteInvoice(id: string): Promise<void> {
        const db = await this.getDb();
        // Soft delete
        const now = new Date().getTime();
        await db.update(invoices)
            .set({ deletedAt: now, updatedAt: now })
            .where(eq(invoices.id, id));
    }

    async findByExternalKey(externalId: string, externalReference: string): Promise<Invoice | null> {
        const db = await this.getSqlDb();
        const [result] = await db.executeSql(
            'SELECT * FROM invoices WHERE external_id = ? AND external_reference = ?',
            [externalId, externalReference]
        );
        if (result.rows.length === 0) return null;
        return this.mapToEntity(result.rows.item(0) as any);
    }

    async listInvoices(params?: InvoiceFilterParams): Promise<{ items: Invoice[]; total: number }> {
        const db = await this.getSqlDb();

        const where: string[] = ['deleted_at IS NULL'];
        const args: any[] = [];

        if (params) {
            if (params.projectId) {
                where.push('project_id = ?');
                args.push(params.projectId);
            }
            if (params.status && params.status.length > 0) {
                where.push(`status IN (${params.status.map(() => '?').join(', ')})`);
                args.push(...params.status);
            }
            if (params.dateRange) {
                const start = new Date(params.dateRange.start).getTime();
                const end = new Date(params.dateRange.end).getTime();
                where.push('date_issued >= ? AND date_issued <= ?');
                args.push(start, end);
            }
        }

        const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
        const limit = params?.limit ?? 50;
        const offset = params?.offset ?? 0;

        const [rows] = await db.executeSql(
            `SELECT * FROM invoices ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...args, limit, offset]
        );

        const items: Invoice[] = [];
        for (let i = 0; i < rows.rows.length; i++) {
            items.push(this.mapToEntity(rows.rows.item(i) as any));
        }

        const [countRows] = await db.executeSql(
            `SELECT COUNT(*) as count FROM invoices ${whereSql}`,
            args
        );
        const total = countRows.rows.length ? countRows.rows.item(0).count : 0;

        return { items, total };
    }

    async assignProject(invoiceId: string, projectId: string): Promise<Invoice> {
        return this.updateInvoice(invoiceId, { projectId });
    }
}
