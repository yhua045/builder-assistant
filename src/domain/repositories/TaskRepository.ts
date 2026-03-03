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
  findDelayReasons(taskId: string): Promise<DelayReason[]>;
}
