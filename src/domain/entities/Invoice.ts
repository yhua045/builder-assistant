import { Payment } from './Payment';

export interface InvoiceLineItem {
  id?: string;
  description: string;
  quantity?: number;
  unitCost?: number;
  total?: number;
  tax?: number;
  // Backwards-compatible aliases
  unitPrice?: number;
  amount?: number;
}

export interface Invoice {
  id: string;                 // Internal UUID
  projectId?: string;         // Optional link to project
  
  // External Uniqueness
  externalId?: string | null;         // Issuer/Source system ID
  externalReference?: string | null;  // Invoice number from issuer
  // Backwards-compatible aliases
  invoiceNumber?: string;
  vendor?: string;
  
  // Metadata
  issuerName?: string;
  issuerAddress?: string;
  issuerTaxId?: string;
  recipientName?: string;
  recipientId?: string;
  
  // Financials
  total: number;
  currency: string;
  subtotal?: number;
  tax?: number;
  
  // Lifecycle
  status: 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'failed';
  
  // Dates
  dateIssued?: string;
  dateDue?: string;
  paymentDate?: string;
  // Backwards-compatible aliases
  issueDate?: string;
  dueDate?: string;
  
  // Content & Audit
  documentId?: string;        // Link to PDF/Scan via Document storage
  lineItems?: InvoiceLineItem[];
  tags?: string[];
  notes?: string;
  metadata?: Record<string, any>;
  
  // Relations
  taskId?: string;            // Soft FK to Task that generated this invoice

  // Legacy / Compatibility fields
  contactId?: string; 
  quoteId?: string;           // Soft FK to Quotation (persisted in DB)
  relatedExpenseIds?: string[];
  attachments?: string[];

  createdAt: string;
  updatedAt: string;
  deletedAt?: string;         // Soft delete
}

export class InvoiceEntity {
  constructor(private readonly _data: Invoice) {}

  static create(
    payload: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'paymentStatus' | 'currency'> & {
      id?: string;
      status?: Invoice['status'];
      paymentStatus?: Invoice['paymentStatus'];
      currency?: string;
    }
  ): InvoiceEntity {
    const id = payload.id ?? `inv_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const now = new Date().toISOString();
    
    // Default values
    const inv: Invoice = { 
      ...payload, 
      id, 
      createdAt: now, 
      updatedAt: now,
      status: payload.status || 'draft',
      paymentStatus: payload.paymentStatus || 'unpaid',
      currency: payload.currency || 'USD'
    } as Invoice;
      // Domain validations
      // 1. total must be non-negative
      if (inv.total == null || typeof inv.total !== 'number' || inv.total < 0) {
        throw new Error('Invoice total must be a non-negative number');
      }

      // 2. If line items are provided, their sum should match subtotal/total if present
      if (inv.lineItems && inv.lineItems.length > 0) {
        const sum = inv.lineItems.reduce((acc, it) => {
          const qty = typeof it.quantity === 'number' ? it.quantity : 1;
          const unit = typeof it.unitCost === 'number' ? it.unitCost : 0;
          const itemTotal = typeof it.total === 'number' ? it.total : qty * unit;
          const tax = typeof it.tax === 'number' ? it.tax : 0;
          return acc + itemTotal + tax;
        }, 0);
        // allow small floating point tolerance
        const tol = 0.0001;
        if (inv.subtotal && Math.abs(inv.subtotal - sum) > tol) {
          throw new Error('Invoice subtotal does not match sum of line items');
        }
        // if subtotal missing, check against total (after tax)
        if (!inv.subtotal && Math.abs(inv.total - sum) > tol) {
          throw new Error('Invoice total does not match sum of line items');
        }
      }

      // 3. Dates: if both provided, due date must be same or after issue date
      if (inv.dateIssued && inv.dateDue) {
        const issued = new Date(inv.dateIssued).getTime();
        const due = new Date(inv.dateDue).getTime();
        if (Number.isFinite(issued) && Number.isFinite(due) && due < issued) {
          throw new Error('Invoice due date must be on or after issue date');
        }
      }

      return new InvoiceEntity(inv);
  }

  data(): Invoice { return { ...this._data }; }

  /** Returns whether this invoice can be cancelled given its linked payments. */
  canBeCancelled(linkedPayments: Payment[]): { allowed: boolean; reason?: string } {
    const hasSettled = linkedPayments.some((p) => p.status === 'settled');
    if (hasSettled) {
      return {
        allowed: false,
        reason: 'Invoice has one or more settled payments. Reverse all payments before cancelling.',
      };
    }
    return { allowed: true };
  }

  /**
   * Marks the invoice as cancelled.
   * Throws a domain error if the invoice has settled payments.
   */
  cancel(linkedPayments: Payment[]): void {
    const check = this.canBeCancelled(linkedPayments);
    if (!check.allowed) throw new Error(check.reason);
  }
}
