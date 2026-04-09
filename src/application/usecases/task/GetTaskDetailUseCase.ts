import { Task } from '../../../domain/entities/Task';
import { TaskRepository } from '../../../domain/repositories/TaskRepository';
import { DelayReason } from '../../../domain/entities/DelayReason';
import { ProgressLog } from '../../../domain/entities/ProgressLog';
import { Quotation } from '../../../domain/entities/Quotation';
import { QuotationRepository } from '../../../domain/repositories/QuotationRepository';

export interface TaskDetail extends Task {
  dependencyTasks: Task[];
  delayReasons: DelayReason[];
  progressLogs: ProgressLog[];
  linkedQuotations: Quotation[];
}

export class GetTaskDetailUseCase {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly quotationRepository?: QuotationRepository,
  ) {}

  async execute(taskId: string): Promise<TaskDetail | null> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) return null;

    const [dependencyTasks, delayReasons, progressLogs, linkedQuotations] = await Promise.all([
      this.taskRepository.findDependencies(taskId),
      this.taskRepository.findDelayReasons(taskId),
      this.taskRepository.findProgressLogs(taskId),
      this.quotationRepository ? this.quotationRepository.findByTask(taskId) : Promise.resolve([]),
    ]);

    return {
      ...task,
      dependencyTasks,
      delayReasons,
      progressLogs,
      linkedQuotations,
    };
  }
}
