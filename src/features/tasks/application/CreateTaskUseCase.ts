import { Task, TaskEntity } from '../../../domain/entities/Task';
import { TaskRepository } from '../../../domain/repositories/TaskRepository';

export class CreateTaskUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(params: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'localId'> & { id?: string }): Promise<Task> {
    const taskEntity = TaskEntity.create(params);
    const task = taskEntity.data();
    await this.taskRepository.save(task);
    return task;
  }
}
