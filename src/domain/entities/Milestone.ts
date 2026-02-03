export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  targetDate?: string;
  status?: 'planned' | 'in_progress' | 'done' | 'blocked';
  linkedTaskIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export class MilestoneEntity {
  constructor(private readonly _data: Milestone) {}

  static create(payload: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): MilestoneEntity {
    const id = payload.id ?? `ms_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const now = new Date().toISOString();
    const m: Milestone = { ...payload, id, createdAt: now, updatedAt: now } as Milestone;
    return new MilestoneEntity(m);
  }

  data(): Milestone { return { ...this._data }; }
}
