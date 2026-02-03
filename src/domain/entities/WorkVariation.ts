export interface WorkVariation {
  id: string;
  localId?: number; // SQLite INTEGER PRIMARY KEY
  projectId: string;
  inspectionId?: string;
  description?: string;
  requestedBy?: string; // contactId
  assignedTo?: string; // contactId
  estimatedCost?: number;
  approvedBy?: string;
  status?: 'proposed' | 'approved' | 'in_progress' | 'completed' | 'rejected';
  relatedTaskIds?: string[];
  relatedExpenseIds?: string[];
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
