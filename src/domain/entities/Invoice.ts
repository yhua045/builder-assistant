export interface InvoiceLineItem {
  id?: string;
  description: string;
  quantity?: number;
  unitCost?: number;
  total?: number;
}

export interface Invoice {
  id: string;
  localId?: number; // SQLite INTEGER PRIMARY KEY
  projectId: string;
  // Contact who issued the invoice (preferred explicit name)
  vendorId?: string; // contacts.id (DEPRECATED: use `contactId`)
  contactId?: string; // contacts.id - preferred

  // Amount fields
  amount?: number; // legacy field
  totalAmount?: number; // preferred explicit field for invoice total
  currency?: string;
  issueDate?: string;
  dueDate?: string;
  paidAmount?: number;
  // Expanded lifecycle status
  status?: 'draft' | 'received' | 'approved' | 'unpaid' | 'partially_paid' | 'paid' | 'overdue';
  
  // Optional link back to originating quote
  quoteId?: string;
  lineItems?: InvoiceLineItem[];
  relatedExpenseIds?: string[];
  attachments?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export class InvoiceEntity {
  constructor(private readonly _data: Invoice) {}

  static create(payload: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): InvoiceEntity {
    const id = payload.id ?? `inv_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const now = new Date().toISOString();
    const inv: Invoice = { ...payload, id, createdAt: now, updatedAt: now } as Invoice;
    return new InvoiceEntity(inv);
  }

  data(): Invoice { return { ...this._data }; }
}
