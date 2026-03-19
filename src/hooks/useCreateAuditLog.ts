import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { AuditLogRepository } from '../domain/repositories/AuditLogRepository';
import {
  CreateAuditLogEntryUseCase,
  CreateAuditLogEntryParams,
} from '../application/usecases/auditlog/CreateAuditLogEntryUseCase';
import { invalidations } from './queryKeys';
import '../infrastructure/di/registerServices';

export function useCreateAuditLog() {
  const queryClient = useQueryClient();
  const repo = useMemo(
    () => container.resolve<AuditLogRepository>('AuditLogRepository'),
    [],
  );
  const useCase = useMemo(() => new CreateAuditLogEntryUseCase(repo), [repo]);

  const createEntry = useCallback(
    async (params: CreateAuditLogEntryParams) => {
      const entry = await useCase.execute(params);
      await Promise.all(
        invalidations
          .auditLogWritten({ projectId: params.projectId, taskId: params.taskId })
          .map(key => queryClient.invalidateQueries({ queryKey: key })),
      );
      return entry;
    },
    [useCase, queryClient],
  );

  return { createEntry };
}
