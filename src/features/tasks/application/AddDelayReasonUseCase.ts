import { TaskRepository } from '../../../domain/repositories/TaskRepository';
import { DelayReasonTypeRepository } from '../../../domain/repositories/DelayReasonTypeRepository';
import { DelayReason } from '../../../domain/entities/DelayReason';

export interface AddDelayReasonInput {
  taskId: string;
  reasonTypeId: string;
  notes?: string;
  delayDurationDays?: number;
  delayDate?: string;
  actor?: string;
}

export class AddDelayReasonUseCase {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly delayReasonTypeRepository: DelayReasonTypeRepository,
  ) {}

  async execute(input: AddDelayReasonInput): Promise<DelayReason> {
    const { taskId, reasonTypeId, notes, delayDurationDays, delayDate, actor } = input;

    // Validate reasonTypeId
    if (!reasonTypeId || reasonTypeId.trim() === '') {
      throw new Error('Reason type is required');
    }

    const reasonType = await this.delayReasonTypeRepository.findById(reasonTypeId);
    if (!reasonType) {
      throw new Error(`Reason type not found: ${reasonTypeId}`);
    }

    // Validate task exists
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Create delay reason entry
    const result = await this.taskRepository.addDelayReason({
      taskId,
      reasonTypeId,
      notes,
      delayDurationDays,
      delayDate,
      actor,
    });

    // If task is not already blocked, set it to blocked
    if (task.status !== 'blocked') {
      await this.taskRepository.update({ ...task, status: 'blocked' });
    }

    return result;
  }
}
