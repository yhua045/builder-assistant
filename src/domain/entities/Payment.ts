export interface Payment {
  id: string;
  localId?: number; // SQLite INTEGER PRIMARY KEY
  projectId?: string;
  invoiceId?: string;
  expenseId?: string;
  contactId?: string; // optional link to Contact (payee/vendor)
  amount: number;
  date?: string;
  dueDate?: string;
  currency?: string;
  notes?: string;
  method?: 'bank' | 'cash' | 'check' | 'card' | 'other';
  status?: 'pending' | 'settled';
  reference?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class PaymentEntity {
  constructor(private readonly _data: Payment) {}

  static create(payload: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): PaymentEntity {
    const id = payload.id ?? `pay_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const now = new Date().toISOString();
    const p: Payment = { ...payload, id, createdAt: now, updatedAt: now } as Payment;
    return new PaymentEntity(p);
  }

  data(): Payment { return { ...this._data }; }
}
