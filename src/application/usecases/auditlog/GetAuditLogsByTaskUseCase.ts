import { AuditLog } from '../../../domain/entities/AuditLog';
import { AuditLogRepository } from '../../../domain/repositories/AuditLogRepository';

export class GetAuditLogsByTaskUseCase {
  constructor(private readonly repo: AuditLogRepository) {}

  async execute(taskId: string): Promise<AuditLog[]> {
    const logs = await this.repo.findByTaskId(taskId);
    return [...logs].sort(
      (a, b) => new Date(b.timestampUtc).getTime() - new Date(a.timestampUtc).getTime(),
    );
  }
}
