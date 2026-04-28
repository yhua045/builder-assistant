import { ProgressLog } from '../../../domain/entities/ProgressLog';
import { TaskRepository } from '../../../domain/repositories/TaskRepository';

export interface UpdateProgressLogInput {
  logId: string;
  logType?: ProgressLog['logType'];
  notes?: string;
  actor?: string;
  photos?: string[];
  date?: number;
  reasonTypeId?: string;
  delayDurationDays?: number;
}

export class UpdateProgressLogUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(input: UpdateProgressLogInput): Promise<ProgressLog> {
    const { logId, ...patch } = input;
    return this.taskRepository.updateProgressLog(logId, patch);
  }
}
