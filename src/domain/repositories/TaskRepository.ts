import { Task } from '../entities/Task';

export interface TaskRepository {
  save(task: Task): Promise<void>;
  findById(id: string): Promise<Task | null>;
  findAll(): Promise<Task[]>;
  findByProjectId(projectId: string): Promise<Task[]>;
  findUpcoming(projectId: string, daysAhead?: number): Promise<Task[]>;
  update(task: Task): Promise<void>;
  delete(id: string): Promise<void>;
}
