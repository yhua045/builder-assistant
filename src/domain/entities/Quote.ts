export interface QuoteLineItem {
  id?: string;
  description: string;
  quantity?: number;
  unitCost?: number;
  total?: number;
  notes?: string;
}

export interface Quote {
  id: string;
  localId?: number; // SQLite INTEGER PRIMARY KEY

  // Foreign Keys
  projectId: string;
  contactId: string;

  // Quote Details
  quoteNumber?: string;
  title?: string;
  description?: string;

  // Line Items & Pricing
  lineItems?: QuoteLineItem[];
  totalAmount: number;
  currency?: string;

  // Status & Lifecycle
  status?: 'draft' | 'sent' | 'received' | 'accepted' | 'rejected' | 'expired';
  issuedDate?: string;
  expiryDate?: string;
  acceptedDate?: string;

  // Relationships
  acceptedInvoiceId?: string;

  // Metadata
  attachments?: string[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class QuoteEntity {
  constructor(private readonly _data: Quote) {}

  static create(payload: Omit<Quote, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): QuoteEntity {
    const id = payload.id ?? `quote_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const now = new Date().toISOString();
    const quote: Quote = {
      ...payload,
      id,
      createdAt: now,
      updatedAt: now,
      status: payload.status ?? 'draft',
      currency: payload.currency ?? 'AUD',
    } as Quote;
    return new QuoteEntity(quote);
  }

  data(): Quote { return { ...this._data }; }

  isExpired(): boolean {
    if (!this._data.expiryDate) return false;
    return new Date(this._data.expiryDate) < new Date();
  }

  isAccepted(): boolean {
    return this._data.status === 'accepted';
  }
}
