import { Task } from '../../../domain/entities/Task';
import { TaskRepository } from '../../../domain/repositories/TaskRepository';

export class GetTaskUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(id: string): Promise<Task | null> {
    return this.taskRepository.findById(id);
  }
}
