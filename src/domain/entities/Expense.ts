export interface Expense {
  id: string;
  projectId: string;
  sourceType?: string;
  sourceUri?: string;
  rawText?: string;
  vendorId?: string; // contacts.id
  amount?: number;
  currency?: string;
  date?: string;
  category?: string;
  trade?: string;
  confidence?: number;
  validatedByAI?: boolean;
  status?: 'draft' | 'accepted' | 'rejected';
  createdAt?: string;
  updatedAt?: string;
}

export class ExpenseEntity {
  constructor(private readonly _data: Expense) {}

  static create(payload: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): ExpenseEntity {
    const id = payload.id ?? `exp_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const now = new Date().toISOString();
    const exp: Expense = { ...payload, id, createdAt: now, updatedAt: now } as Expense;
    return new ExpenseEntity(exp);
  }

  data(): Expense { return { ...this._data }; }
}
