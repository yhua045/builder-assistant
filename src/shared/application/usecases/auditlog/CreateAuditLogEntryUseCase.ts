import { AuditLog, AuditLogSource } from '../../../domain/entities/AuditLog';
import { AuditLogRepository } from '../../../domain/repositories/AuditLogRepository';

export interface CreateAuditLogEntryParams {
  projectId: string;
  taskId?: string;
  source: AuditLogSource;
  action: string;
}

export class CreateAuditLogEntryUseCase {
  constructor(private readonly repo: AuditLogRepository) {}

  async execute(params: CreateAuditLogEntryParams): Promise<AuditLog> {
    const entry: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      projectId: params.projectId,
      taskId: params.taskId,
      timestampUtc: new Date().toISOString(),
      source: params.source,
      action: params.action,
    };
    await this.repo.save(entry);
    return entry;
  }
}
