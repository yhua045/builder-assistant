import { Task } from '../../../domain/entities/Task';
import { TaskRepository } from '../../../domain/repositories/TaskRepository';

export interface UpdateTaskDTO {
  taskId: string;
  updates: Partial<Omit<Task, 'id' | 'createdAt' | 'localId'>>;
}

export class UpdateTaskUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(dto: UpdateTaskDTO): Promise<Task> {
    const existing = await this.taskRepository.findById(dto.taskId);
    if (!existing) throw new Error(`Task not found: ${dto.taskId}`);
    const updated: Task = { ...existing, ...dto.updates };
    await this.taskRepository.update(updated);
    return updated;
  }
}
