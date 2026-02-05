export interface WorkVariation {
  id: string;
  localId?: number; // SQLite INTEGER PRIMARY KEY
  projectId: string;
  inspectionId?: string;
  description?: string;
  // Contact references (store contact IDs). Keep old fields for migration compatibility.
  requestedBy?: string; // contactId (DEPRECATED: use `requestedByContactId`)
  requestedByContactId?: string; // contactId - preferred explicit field
  assignedTo?: string; // contactId (DEPRECATED: use `assignedToContactId`)
  assignedToContactId?: string; // contactId - preferred explicit field
  estimatedCost?: number;
  approvedBy?: string; // contactId (DEPRECATED: use `approvedByContactId`)
  approvedByContactId?: string; // contactId - preferred explicit field
  status?: 'proposed' | 'approved' | 'in_progress' | 'completed' | 'rejected';
  relatedTaskIds?: string[];
  // Payments related to this variation. Keep `relatedExpenseIds` for migration/backcompat.
  relatedExpenseIds?: string[];
  relatedPaymentIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export class WorkVariationEntity {
  constructor(private readonly _data: WorkVariation) {}

  static create(payload: Omit<WorkVariation, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): WorkVariationEntity {
    const id = payload.id ?? `wv_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const now = new Date().toISOString();
    const w: WorkVariation = { ...payload, id, createdAt: now, updatedAt: now } as WorkVariation;
    return new WorkVariationEntity(w);
  }

  data(): WorkVariation { return { ...this._data }; }
}
