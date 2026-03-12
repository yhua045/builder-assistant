import { useState, useCallback, useMemo } from 'react';
import { container } from 'tsyringe';
import '../infrastructure/di/registerServices';
import { TaskRepository } from '../domain/repositories/TaskRepository';
import { InvoiceRepository } from '../domain/repositories/InvoiceRepository';
import { AcceptQuoteUseCase } from '../application/usecases/task/AcceptQuoteUseCase';

export interface UseAcceptQuoteReturn {
  acceptQuote: (taskId: string) => Promise<{ invoiceId: string }>;
  rejectQuote: (taskId: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useAcceptQuote(): UseAcceptQuoteReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const taskRepository = useMemo(
    () => container.resolve<TaskRepository>('TaskRepository'),
    [],
  );
  const invoiceRepository = useMemo(
    () => container.resolve<InvoiceRepository>('InvoiceRepository'),
    [],
  );

  const acceptQuoteUseCase = useMemo(
    () => new AcceptQuoteUseCase(taskRepository, invoiceRepository),
    [taskRepository, invoiceRepository],
  );

  const acceptQuote = useCallback(
    async (taskId: string): Promise<{ invoiceId: string }> => {
      setIsLoading(true);
      setError(null);
      try {
        const { invoice } = await acceptQuoteUseCase.execute(taskId);
        return { invoiceId: invoice.id };
      } catch (e: any) {
        const msg = e?.message ?? 'Failed to accept quote';
        setError(msg);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [acceptQuoteUseCase],
  );

  const rejectQuote = useCallback(
    async (taskId: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const task = await taskRepository.findById(taskId);
        if (!task) throw new Error('TASK_NOT_FOUND');
        await taskRepository.update({
          ...task,
          quoteStatus: 'rejected',
          updatedAt: new Date().toISOString(),
        });
      } catch (e: any) {
        const msg = e?.message ?? 'Failed to reject quote';
        setError(msg);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [taskRepository],
  );

  return { acceptQuote, rejectQuote, isLoading, error };
}
