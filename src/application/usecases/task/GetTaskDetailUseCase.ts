import { Task } from '../../../domain/entities/Task';
import { TaskRepository } from '../../../domain/repositories/TaskRepository';
import { DelayReason } from '../../../domain/entities/DelayReason';

export interface TaskDetail extends Task {
  dependencyTasks: Task[];
  delayReasons: DelayReason[];
}

export class GetTaskDetailUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(taskId: string): Promise<TaskDetail | null> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) return null;

    const [dependencyTasks, delayReasons] = await Promise.all([
      this.taskRepository.findDependencies(taskId),
      this.taskRepository.findDelayReasons(taskId),
    ]);

    return {
      ...task,
      dependencyTasks,
      delayReasons,
    };
  }
}
