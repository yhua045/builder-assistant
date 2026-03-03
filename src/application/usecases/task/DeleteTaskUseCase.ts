import { TaskRepository } from '../../../domain/repositories/TaskRepository';

export class DeleteTaskUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(id: string): Promise<void> {
    await this.taskRepository.deleteDependenciesByTaskId(id);
    await this.taskRepository.deleteDelayReasonsByTaskId(id);
    await this.taskRepository.delete(id);
  }
}
