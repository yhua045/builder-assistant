export interface InvoiceLineItem {
  id?: string;
  description: string;
  quantity?: number;
  unitCost?: number;
  total?: number;
  tax?: number;
}

export interface Invoice {
  id: string;                 // Internal UUID
  projectId?: string;         // Optional link to project
  
  // External Uniqueness
  externalId?: string | null;         // Issuer/Source system ID
  externalReference?: string | null;  // Invoice number from issuer
  
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
  
  // Content & Audit
  documentId?: string;        // Link to PDF/Scan via Document storage
  lineItems?: InvoiceLineItem[];
  tags?: string[];
  notes?: string;
  metadata?: Record<string, any>;
  
  // Legacy / Compatibility fields
  contactId?: string; 
  quoteId?: string; 
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
    
    return new InvoiceEntity(inv);
  }

  data(): Invoice { return { ...this._data }; }
}
