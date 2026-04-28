import { TaskRepository } from '../../../domain/repositories/TaskRepository';

export interface RemoveDelayReasonInput {
  delayReasonId: string;
}

export class RemoveDelayReasonUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(input: RemoveDelayReasonInput): Promise<void> {
    await this.taskRepository.removeDelayReason(input.delayReasonId);
  }
}
