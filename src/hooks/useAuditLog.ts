import { useQuery } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { queryKeys } from './queryKeys';
import { AuditLogRepository } from '../shared/domain/repositories/AuditLogRepository';
import { GetAuditLogsByProjectUseCase } from '../shared/application/usecases/auditlog/GetAuditLogsByProjectUseCase';
import { GetAuditLogsByTaskUseCase } from '../shared/application/usecases/auditlog/GetAuditLogsByTaskUseCase';
import '../shared/infrastructure/di/registerServices';

/** Fetch all audit logs for a project (cross-task view). */
export function useAuditLogsByProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.auditLogsByProject(projectId),
    queryFn: async () => {
      const repo = container.resolve<AuditLogRepository>('AuditLogRepository');
      return new GetAuditLogsByProjectUseCase(repo).execute(projectId);
    },
    enabled: Boolean(projectId),
  });
}

/** Fetch audit logs scoped to a single task. */
export function useAuditLogsByTask(taskId: string) {
  return useQuery({
    queryKey: queryKeys.auditLogsByTask(taskId),
    queryFn: async () => {
      const repo = container.resolve<AuditLogRepository>('AuditLogRepository');
      return new GetAuditLogsByTaskUseCase(repo).execute(taskId);
    },
    enabled: Boolean(taskId),
  });
}
