export interface ChangeOrder {
  id: string;
  projectId: string;
  description?: string;
  requestedBy?: string; // contactId
  approvedBy?: string; // contactId
  amountDelta?: number;
  status?: 'proposed' | 'approved' | 'rejected';
  createdAt?: string;
  updatedAt?: string;
}

export class ChangeOrderEntity {
  constructor(private readonly _data: ChangeOrder) {}

  static create(payload: Omit<ChangeOrder, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): ChangeOrderEntity {
    const id = payload.id ?? `co_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const now = new Date().toISOString();
    const c: ChangeOrder = { ...payload, id, createdAt: now, updatedAt: now } as ChangeOrder;
    return new ChangeOrderEntity(c);
  }

  data(): ChangeOrder { return { ...this._data }; }
}
