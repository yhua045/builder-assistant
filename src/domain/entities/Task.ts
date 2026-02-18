export interface Task {
  id: string;
  localId?: number; // SQLite INTEGER PRIMARY KEY
  projectId?: string; // Optional for ad-hoc tasks
  title: string;
  description?: string;
  notes?: string;
  
  // Scheduling
  isScheduled?: boolean;
  scheduledAt?: string; // ISO Date string
  dueDate?: string;     // ISO Date string
  
  // Backwards-compatible assignedTo; prefer `assignedToContactId` for clarity
  assignedTo?: string; // contactId (DEPRECATED: use `assignedToContactId`)
  assignedToContactId?: string; // contactId - preferred explicit field
  trade?: string;
  
  scheduledStart?: string; // Deprecated in favor of scheduledAt? Keeping for now.
  scheduledEnd?: string;
  durationEstimate?: number; // in hours
  
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  
  dependencies?: string[]; // taskIds
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
}

export class TaskEntity {
  constructor(private readonly task: Task) {}

  static create(payload: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): TaskEntity {
    const id = payload.id ?? `task_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const now = new Date().toISOString();
    const t: Task = { 
        ...payload, 
        id, 
        createdAt: now, 
        updatedAt: now,
        status: payload.status ?? 'pending' 
    } as Task;
    return new TaskEntity(t);
  }

  data(): Task { return { ...this.task }; }
}
