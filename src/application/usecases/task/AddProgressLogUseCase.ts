import { ProgressLog } from '../../../domain/entities/ProgressLog';
import { TaskRepository } from '../../../domain/repositories/TaskRepository';

export interface AddProgressLogInput {
  taskId: string;
  logType: ProgressLog['logType'];
  notes?: string;
  date?: number;
  actor?: string;
  photos?: string[];
  reasonTypeId?: string;
  delayDurationDays?: number;
}

export class AddProgressLogUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(input: AddProgressLogInput): Promise<ProgressLog> {
    const log = await this.taskRepository.addProgressLog(input);
    return log;
  }
}
