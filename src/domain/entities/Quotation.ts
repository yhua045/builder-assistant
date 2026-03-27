export interface QuotationLineItem {
  id?: string;
  description: string;
  quantity?: number;
  unitPrice?: number;
  tax?: number;
  total?: number;
}

export interface Quotation {
  // Identity
  id: string;                    // Internal UUID
  reference: string;             // Human-friendly quotation number (e.g., "QT-2026-001")
  
  // Relations
  projectId?: string;            // Optional link to Project
  taskId?: string;               // Soft FK to Task; set when quotation is linked to a task
  documentId?: string;           // Soft FK to Document (uploaded PDF/scan)
  vendorId?: string;             // Link to Contact (vendor)
  contactId?: string;            // Alias for vendorId (compatibility)
  
  // Metadata
  vendorName?: string;
  vendorAddress?: string;
  vendorEmail?: string;
  
  // Dates
  date: string;                  // ISO date - quotation issue date
  expiryDate?: string;           // ISO date - when quotation expires
  
  // Financials
  currency: string;              // Default: 'USD'
  subtotal?: number;             // Sum of line items before tax
  taxTotal?: number;             // Total tax amount
  total: number;                 // Grand total
  
  // Content
  lineItems?: QuotationLineItem[];
  notes?: string;
  
  // Status & Lifecycle
  status: 'draft' | 'sent' | 'accepted' | 'declined';
  
  // Audit fields
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  deletedAt?: string;            // ISO timestamp (soft delete)
}

export class QuotationEntity {
  constructor(private readonly _data: Quotation) {}

  static create(
    payload: Omit<Quotation, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'currency'> & {
      id?: string;
      status?: Quotation['status'];
      currency?: string;
    }
  ): QuotationEntity {
    const id = payload.id ?? `quot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    // Auto-generate reference when blank/absent (mirrors InvoiceEntity.create)
    const baseDate = (payload as any).date ? new Date((payload as any).date) : new Date();
    const yyyymmdd = baseDate.toISOString().slice(0, 10).replace(/-/g, '');
    const autoRef = `QUO-${yyyymmdd}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const reference =
      (payload as any).reference && String((payload as any).reference).trim().length > 0
        ? String((payload as any).reference).trim()
        : autoRef;

    // Default values
    const quotation: Quotation = {
      ...payload,
      reference,
      id,
      createdAt: now,
      updatedAt: now,
      status: payload.status || 'draft',
      currency: payload.currency || 'AUD',
    } as Quotation;

    // Domain validations
    // 1. date is required and must be valid
    if (!quotation.date) {
      throw new Error('Quotation date is required');
    }
    const dateMs = new Date(quotation.date).getTime();
    if (!Number.isFinite(dateMs)) {
      throw new Error('Quotation date must be a valid ISO date');
    }

    // 2. total must be non-negative
    if (quotation.total == null || typeof quotation.total !== 'number' || quotation.total < 0) {
      throw new Error('Quotation total must be a non-negative number');
    }

    // 3. If expiryDate provided, it must be valid and >= date
    if (quotation.expiryDate) {
      const expiryMs = new Date(quotation.expiryDate).getTime();
      if (!Number.isFinite(expiryMs)) {
        throw new Error('Quotation expiry date must be a valid ISO date');
      }
      if (expiryMs < dateMs) {
        throw new Error('Quotation expiry date must be on or after quotation date');
      }
    }

    // 4. If line items are provided, their sum should match subtotal/total if present
    if (quotation.lineItems && quotation.lineItems.length > 0) {
      const sum = quotation.lineItems.reduce((acc, item) => {
        const qty = typeof item.quantity === 'number' ? item.quantity : 1;
        const unit = typeof item.unitPrice === 'number' ? item.unitPrice : 0;
        const itemTotal = typeof item.total === 'number' ? item.total : qty * unit;
        const tax = typeof item.tax === 'number' ? item.tax : 0;
        return acc + itemTotal + tax;
      }, 0);

      // Allow small floating point tolerance
      const tolerance = 0.01;
      if (quotation.subtotal && Math.abs(quotation.subtotal - sum) > tolerance) {
        throw new Error('Quotation subtotal does not match sum of line items');
      }
      // If subtotal missing, check against total (after tax)
      if (!quotation.subtotal && Math.abs(quotation.total - sum) > tolerance) {
        throw new Error('Quotation total does not match sum of line items');
      }
    }

    return new QuotationEntity(quotation);
  }

  data(): Quotation {
    return { ...this._data };
  }
}
