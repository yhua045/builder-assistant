import { TaskRepository } from '../../../shared/domain/repositories/TaskRepository';

export interface DeleteProgressLogInput {
  logId: string;
}

export class DeleteProgressLogUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(input: DeleteProgressLogInput): Promise<void> {
    return this.taskRepository.deleteProgressLog(input.logId);
  }
}
