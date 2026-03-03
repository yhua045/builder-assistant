import { Task } from '../entities/Task';
import { DelayReason } from '../entities/DelayReason';

export interface TaskRepository {
  save(task: Task): Promise<void>;
  findById(id: string): Promise<Task | null>;
  findAll(): Promise<Task[]>;
  findByProjectId(projectId: string): Promise<Task[]>;
  findAdHoc(): Promise<Task[]>;
  findUpcoming(projectId?: string, daysAhead?: number): Promise<Task[]>; 
  update(task: Task): Promise<void>;
  delete(id: string): Promise<void>;

  // Dependencies
  addDependency(taskId: string, dependsOnTaskId: string): Promise<void>;
  removeDependency(taskId: string, dependsOnTaskId: string): Promise<void>;
  findDependencies(taskId: string): Promise<Task[]>;
  findDependents(taskId: string): Promise<Task[]>;

  // Delay reasons
  addDelayReason(entry: Omit<DelayReason, 'id' | 'createdAt'>): Promise<DelayReason>;
  removeDelayReason(delayReasonId: string): Promise<void>;
  resolveDelayReason(delayReasonId: string, resolvedAt: string, mitigationNotes?: string): Promise<void>;
  findDelayReasons(taskId: string): Promise<DelayReason[]>;
  /** Returns counts per reason type, optionally filtered to a single task. */
  summarizeDelayReasons(taskId?: string): Promise<{ reasonTypeId: string; count: number }[]>;

  // Cascade helpers (used by DeleteTaskUseCase)
  deleteDependenciesByTaskId(taskId: string): Promise<void>;
  deleteDelayReasonsByTaskId(taskId: string): Promise<void>;
}
