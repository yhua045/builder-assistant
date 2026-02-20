export type DocumentStatus = 'local-only' | 'upload-pending' | 'uploaded' | 'failed';

export interface Document {
  id: string;
  localId?: number; // SQLite INTEGER PRIMARY KEY
  projectId?: string; // Optional
  type?: 'plan' | 'permit' | 'invoice' | 'photo' | string;
  title?: string;
  mimeType?: string;
  size?: number; // in bytes
  filename?: string;
  
  // Storage & Sync
  status: DocumentStatus;
  localPath?: string;
  storageKey?: string;
  cloudUrl?: string;
  
  // Relationships
  taskId?: string; // Optional link to a Task (e.g. photo attachment)

  // Provenance
  source?: 'camera' | 'scan' | 'import';
  uploadedBy?: string;
  uploadedAt?: string;
  checksum?: string;
  ocrText?: string;
  tags?: string[]; // stored as JSON array string

  uri?: string; // Legacy field, maybe deprecate or map to localPath/cloudUrl
  issuedBy?: string; // contact id or string
  issuedDate?: string;
  expiresAt?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export class DocumentEntity {
  constructor(private readonly _data: Document) {}

  static create(payload: Omit<Document, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { id?: string, status?: DocumentStatus }): DocumentEntity {
    const id = payload.id ?? `doc_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const now = new Date().toISOString();
    const d: Document = { 
      ...payload, 
      id, 
      status: payload.status ?? 'local-only',
      createdAt: now, 
      updatedAt: now 
    } as Document;
    return new DocumentEntity(d);
  }

  data(): Document { return { ...this._data }; }
  
  assignProject(projectId: string): void {
    this._data.projectId = projectId;
    this._data.updatedAt = new Date().toISOString();
  }
}
