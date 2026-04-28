import { TaskRepository } from '../../../domain/repositories/TaskRepository';

export interface RemoveTaskDependencyInput {
  taskId: string;
  dependsOnTaskId: string;
}

export class RemoveTaskDependencyUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(input: RemoveTaskDependencyInput): Promise<void> {
    await this.taskRepository.removeDependency(input.taskId, input.dependsOnTaskId);
  }
}
