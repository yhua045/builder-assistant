export interface Document {
  id: string;
  projectId: string;
  type?: 'plan' | 'permit' | 'invoice' | 'photo' | string;
  title?: string;
  uri?: string;
  issuedBy?: string; // contact id or string
  issuedDate?: string;
  expiresAt?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class DocumentEntity {
  constructor(private readonly _data: Document) {}

  static create(payload: Omit<Document, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): DocumentEntity {
    const id = payload.id ?? `doc_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const now = new Date().toISOString();
    const d: Document = { ...payload, id, createdAt: now, updatedAt: now } as Document;
    return new DocumentEntity(d);
  }

  data(): Document { return { ...this._data }; }
}
