export interface Inspection {
  id: string;
  projectId: string;
  scheduledDate?: string;
  inspectorId?: string; // contacts.id
  status?: 'pending' | 'passed' | 'failed';
  findings?: string;
  photos?: string[]; // URIs
  relatedTaskIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export class InspectionEntity {
  constructor(private readonly _data: Inspection) {}

  static create(payload: Omit<Inspection, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): InspectionEntity {
    const id = payload.id ?? `insp_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const now = new Date().toISOString();
    const insp: Inspection = { ...payload, id, createdAt: now, updatedAt: now } as Inspection;
    return new InspectionEntity(insp);
  }

  data(): Inspection { return { ...this._data }; }
}
