export interface Task {
  id: string;
  localId?: number; // SQLite INTEGER PRIMARY KEY
  projectId: string;
  title: string;
  description?: string;
  // Backwards-compatible assignedTo; prefer `assignedToContactId` for clarity
  assignedTo?: string; // contactId (DEPRECATED: use `assignedToContactId`)
  assignedToContactId?: string; // contactId - preferred explicit field
  trade?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  durationEstimate?: number; // in hours
  status?: 'pending' | 'in_progress' | 'done' | 'cancelled' | 'rework_required';
  priority?: number;
  dependencies?: string[]; // taskIds
  createdAt?: string;
  updatedAt?: string;
}

export class TaskEntity {
  constructor(private readonly task: Task) {}

  static create(payload: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): TaskEntity {
    const id = payload.id ?? `task_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const now = new Date().toISOString();
    const t: Task = { ...payload, id, createdAt: now, updatedAt: now } as Task;
    return new TaskEntity(t);
  }

  data(): Task { return { ...this.task }; }
}
