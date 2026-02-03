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
  vendorId?: string; // contacts.id
  amount?: number;
  currency?: string;
  issueDate?: string;
  dueDate?: string;
  paidAmount?: number;
  status?: 'unpaid' | 'partially_paid' | 'paid' | 'overdue';
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
