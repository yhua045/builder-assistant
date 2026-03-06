import { Task } from '../entities/Task';
import { DelayReason } from '../entities/DelayReason';
import { ProgressLog } from '../entities/ProgressLog';

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
  /**
   * Returns all dependency edges for tasks belonging to the given project.
   * Used by GetCockpitDataUseCase to build the full adjacency graph in one query
   * instead of N per-task fetches.
   */
  findAllDependencies(projectId: string): Promise<{ taskId: string; dependsOnTaskId: string }[]>;

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

  findProgressLogs(taskId: string): Promise<ProgressLog[]>;
  addProgressLog(log: Omit<ProgressLog, 'id' | 'createdAt'>): Promise<ProgressLog>;
}
