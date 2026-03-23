import { DelayReason } from './DelayReason';

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
  startDate?: string;   // ISO Date string — when work on this task begins
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
  
  // Subcontractor
  subcontractorId?: string; // contactId of assigned subcontractor

  // Dependencies & delays (hydrated by repository on single-task fetches)
  dependencies?: string[]; // taskIds
  delayReasons?: DelayReason[];

  // Cockpit: manual critical-path pin. User sets this to always show in Focus-3.
  isCriticalPath?: boolean;

  /** Phase this task belongs to (FK to ProjectPhase.id). Optional for ad-hoc tasks. */
  phaseId?: string;

  /**
   * URIs of photos attached to this task.
   * Supports both local paths (file://) and remote URLs (https://).
   * Stored as a JSON array in SQLite.
   */
  photos?: string[];

  /**
   * Free-text site constraint note surfaced to the AI suggestion engine.
   * e.g. "Access via rear lane only — no heavy vehicles before 9 am"
   */
  siteConstraints?: string;

  // Task classification (issue #141)
  taskType?: 'standard' | 'variation' | 'contract_work';

  // Work/trade category for cost-roll-up reporting (issue #141)
  workType?: string;

  /**
   * 1-based construction sequence number assigned by CriticalPathService.
   * Tasks created from critical-path suggestions carry their order so the
   * Tasks screen can sort by ORDER ASC NULLS LAST before dates are set.
   */
  order?: number;

  // Quote fields — only meaningful for variation/contract_work tasks (issue #141)
  quoteAmount?: number;     // quoted cost in AUD
  /** pending=no quote data yet; issued=amount captured; accepted/rejected=builder decision */
  quoteStatus?: 'pending' | 'issued' | 'accepted' | 'rejected';
  quoteInvoiceId?: string; // soft FK to invoices.id; set on acceptance

  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
}

/** Default list of work types for the Work Type selector. */
export const PREDEFINED_WORK_TYPES = [
  'Demolition', 'Storm Water', 'Pool', 'Framing', 'Roofing',
  'Electrical', 'Plumbing', 'Tiling', 'Plastering', 'Painting',
  'Landscaping', 'Concrete', 'Brickwork', 'Carpentry',
] as const;

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
