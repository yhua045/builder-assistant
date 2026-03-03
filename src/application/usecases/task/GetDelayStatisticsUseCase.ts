import { TaskRepository } from '../../../domain/repositories/TaskRepository';
import { DelayReasonTypeRepository } from '../../../domain/repositories/DelayReasonTypeRepository';

export interface DelayStatEntry {
  reasonTypeId: string;
  label: string;
  count: number;
}

export interface GetDelayStatisticsInput {
  /** Filter to a single task; omit for project-wide / global summary. */
  taskId?: string;
}

export class GetDelayStatisticsUseCase {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly delayReasonTypeRepository: DelayReasonTypeRepository,
  ) {}

  async execute(input: GetDelayStatisticsInput = {}): Promise<DelayStatEntry[]> {
    const [summary, types] = await Promise.all([
      this.taskRepository.summarizeDelayReasons(input.taskId),
      this.delayReasonTypeRepository.findAll(),
    ]);

    const labelMap = new Map(types.map((t) => [t.id, t.label]));

    return summary.map((row) => ({
      reasonTypeId: row.reasonTypeId,
      label: labelMap.get(row.reasonTypeId) ?? row.reasonTypeId,
      count: row.count,
    }));
  }
}
