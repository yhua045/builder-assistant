import { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { container } from 'tsyringe';
import '../infrastructure/di/registerServices';
import { TaskRepository } from '../domain/repositories/TaskRepository';
import { InvoiceRepository } from '../domain/repositories/InvoiceRepository';
import { ContactRepository } from '../domain/repositories/ContactRepository';
import { QuotationRepository } from '../domain/repositories/QuotationRepository';
import { AcceptQuotationUseCase } from '../application/usecases/quotation/AcceptQuotationUseCase';
import { invalidations } from './queryKeys';

export interface UseAcceptQuoteReturn {
  acceptQuote: (taskId: string) => Promise<{ invoiceId: string }>;
  rejectQuote: (taskId: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function useAcceptQuote(): UseAcceptQuoteReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const taskRepository = useMemo(
    () => container.resolve<TaskRepository>('TaskRepository'),
    [],
  );
  const invoiceRepository = useMemo(
    () => container.resolve<InvoiceRepository>('InvoiceRepository'),
    [],
  );
  const contactRepository = useMemo(() => {
    try { return container.resolve<ContactRepository>('ContactRepository'); }
    catch { return null; }
  }, []);
  const quotationRepository = useMemo(() => {
    try { return container.resolve<QuotationRepository>('QuotationRepository'); }
    catch { return null; }
  }, []);

  const acceptQuotationUseCase = useMemo(
    () => new AcceptQuotationUseCase(
      invoiceRepository,
      taskRepository,
      quotationRepository ?? undefined,
    ),
    [invoiceRepository, taskRepository, quotationRepository],
  );

  const acceptQuote = useCallback(
    async (taskId: string): Promise<{ invoiceId: string }> => {
      setIsLoading(true);
      setError(null);
      try {
        const task = await taskRepository.findById(taskId);
        if (!task) throw new Error('TASK_NOT_FOUND');
        if (task.taskType !== 'contract_work') throw new Error('NOT_CONTRACT_WORK');
        if (task.quoteStatus === 'accepted') throw new Error('QUOTE_ALREADY_ACCEPTED');

        const contact = task.subcontractorId && contactRepository
          ? await contactRepository.findById(task.subcontractorId)
          : null;

        const { invoice } = await acceptQuotationUseCase.execute({
          taskId,
          task: {
            title: task.title,
            projectId: task.projectId,
            quoteAmount: task.quoteAmount ?? 0,
            taskType: task.taskType,
            workType: task.workType,
            subcontractorId: task.subcontractorId,
          },
          contact,
        });
        if (queryClient) {
          await Promise.all(
            invalidations.acceptQuotation({ projectId: task.projectId ?? '', taskId })
              .map(key => queryClient!.invalidateQueries({ queryKey: key }))
          );
        }
        return { invoiceId: invoice.id };
      } catch (e: any) {
        const msg = e?.message ?? 'Failed to accept quote';
        setError(msg);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [taskRepository, contactRepository, acceptQuotationUseCase, queryClient],
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
        if (queryClient) {
          await Promise.all(
            invalidations.rejectQuotation({ projectId: task.projectId ?? '', taskId })
              .map(key => queryClient!.invalidateQueries({ queryKey: key }))
          );
        }
      } catch (e: any) {
        const msg = e?.message ?? 'Failed to reject quote';
        setError(msg);
        throw e;
      } finally {
        setIsLoading(false);
      }
    },
    [taskRepository, queryClient],
  );

  return { acceptQuote, rejectQuote, isLoading, error };
}
