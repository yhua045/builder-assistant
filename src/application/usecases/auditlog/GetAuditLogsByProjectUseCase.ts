import { AuditLog } from '../../../domain/entities/AuditLog';
import { AuditLogRepository } from '../../../domain/repositories/AuditLogRepository';

export class GetAuditLogsByProjectUseCase {
  constructor(private readonly repo: AuditLogRepository) {}

  async execute(projectId: string): Promise<AuditLog[]> {
    const logs = await this.repo.findByProjectId(projectId);
    return [...logs].sort(
      (a, b) => new Date(b.timestampUtc).getTime() - new Date(a.timestampUtc).getTime(),
    );
  }
}
