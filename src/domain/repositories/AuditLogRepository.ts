import { AuditLog } from '../entities/AuditLog';

export interface AuditLogRepository {
  save(entry: AuditLog): Promise<void>;
  findByProjectId(projectId: string): Promise<AuditLog[]>;
  findByTaskId(taskId: string): Promise<AuditLog[]>;
}
