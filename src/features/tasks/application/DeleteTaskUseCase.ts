import { TaskRepository } from '../../../domain/repositories/TaskRepository';
import { AuditLogRepository } from '../../../domain/repositories/AuditLogRepository';
import { CreateAuditLogEntryUseCase } from '../../../application/usecases/auditlog/CreateAuditLogEntryUseCase';

export class DeleteTaskUseCase {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly auditLogRepository?: AuditLogRepository,
  ) {}

  async execute(id: string): Promise<void> {
    // Capture task data before deletion so the title survives
    const task = this.auditLogRepository
      ? await this.taskRepository.findById(id)
      : null;

    await this.taskRepository.deleteDependenciesByTaskId(id);
    await this.taskRepository.deleteDelayReasonsByTaskId(id);
    await this.taskRepository.delete(id);

    if (task && this.auditLogRepository && task.projectId) {
      await new CreateAuditLogEntryUseCase(this.auditLogRepository).execute({
        projectId: task.projectId,
        taskId: task.id,
        source: 'Task Form',
        action: `Deleted task "${task.title}"`,
      });
    }
  }
}
