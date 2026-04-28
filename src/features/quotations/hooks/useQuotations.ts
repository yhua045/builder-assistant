import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Quotation } from '../../../domain/entities/Quotation';
import { QuotationRepository, QuotationFilterParams } from '../../../domain/repositories/QuotationRepository';
import { TaskRepository } from '../../../domain/repositories/TaskRepository';
import { InvoiceRepository } from '../../../domain/repositories/InvoiceRepository';
import { CreateQuotationUseCase } from '../application/CreateQuotationUseCase';
import { ListQuotationsUseCase } from '../application/ListQuotationsUseCase';
import { GetQuotationByIdUseCase } from '../application/GetQuotationByIdUseCase';
import { UpdateQuotationUseCase } from '../application/UpdateQuotationUseCase';
import { DeleteQuotationUseCase } from '../application/DeleteQuotationUseCase';
import { ApproveQuotationUseCase, ApproveQuotationOutput } from '../application/ApproveQuotationUseCase';
import { DeclineQuotationUseCase } from '../application/DeclineQuotationUseCase';
import { DrizzleQuotationRepository } from '../infrastructure/DrizzleQuotationRepository';
import { container } from 'tsyringe';
import '../../../infrastructure/di/registerServices';
import { queryKeys } from '../../../hooks/queryKeys';

export interface UseQuotationsOptions {
  /** When provided, subscribes reactively to quotations for this task */
  taskId?: string;
}

export const useQuotations = (options?: UseQuotationsOptions) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const repository = useMemo<QuotationRepository>(() => new DrizzleQuotationRepository(), []);
  const taskRepo = useMemo<TaskRepository>(() => container.resolve<TaskRepository>('TaskRepository'), []);
  const invoiceRepo = useMemo<InvoiceRepository>(() => container.resolve<InvoiceRepository>('InvoiceRepository'), []);

  const createQuotationUC = useMemo(() => new CreateQuotationUseCase(repository), [repository]);
  const listQuotationsUC = useMemo(() => new ListQuotationsUseCase(repository), [repository]);
  const getQuotationUC = useMemo(() => new GetQuotationByIdUseCase(repository), [repository]);
  const updateQuotationUC = useMemo(() => new UpdateQuotationUseCase(repository), [repository]);
  const deleteQuotationUC = useMemo(() => new DeleteQuotationUseCase(repository), [repository]);

  /**
   * Reactive quotation list for a specific task. Only active when taskId is
   * provided — otherwise undefined. Invalidated by acceptQuotation / rejectQuotation.
   */
  const { data: taskQuotations } = useQuery<Quotation[]>({
    queryKey: queryKeys.quotations(options?.taskId),
    queryFn: async () => {
      const taskId = options?.taskId;
      if (!taskId) return [];
      return repository.findByTask(taskId);
    },
    enabled: Boolean(options?.taskId),
    staleTime: 60_000,
  });

  const createQuotation = useCallback(async (quotation: Omit<Quotation, 'id' | 'createdAt' | 'updatedAt'>): Promise<Quotation> => {
    setLoading(true);
    setError(null);
    try {
      const created = await createQuotationUC.execute(quotation);
      await queryClient.invalidateQueries({ queryKey: queryKeys.quotations() });
      return created;
    } catch (e: any) {
      const msg = e?.message || 'Failed to create quotation';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, [createQuotationUC, queryClient]);

  const listQuotations = useCallback(async (params?: QuotationFilterParams): Promise<{ items: Quotation[]; total: number }> => {
    setLoading(true);
    setError(null);
    try {
      const result = await listQuotationsUC.execute(params);
      return result;
    } catch (e: any) {
      const msg = e?.message || 'Failed to list quotations';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, [listQuotationsUC]);

  const getQuotation = useCallback(async (id: string): Promise<Quotation | null> => {
    setLoading(true);
    setError(null);
    try {
      const quotation = await getQuotationUC.execute(id);
      return quotation;
    } catch (e: any) {
      const msg = e?.message || 'Failed to get quotation';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, [getQuotationUC]);

  const updateQuotation = useCallback(async (id: string, updates: Partial<Quotation>): Promise<Quotation> => {
    setLoading(true);
    setError(null);
    try {
      const updated = await updateQuotationUC.execute(id, updates);
      await queryClient.invalidateQueries({ queryKey: queryKeys.quotations() });
      return updated;
    } catch (e: any) {
      const msg = e?.message || 'Failed to update quotation';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, [updateQuotationUC, queryClient]);

  const deleteQuotation = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      await deleteQuotationUC.execute(id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.quotations() });
    } catch (e: any) {
      const msg = e?.message || 'Failed to delete quotation';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, [deleteQuotationUC, queryClient]);

  const approveQuotation = useCallback(async (quotationId: string): Promise<ApproveQuotationOutput> => {
    setLoading(true);
    setError(null);
    try {
      const uc = new ApproveQuotationUseCase(invoiceRepo, repository, taskRepo);
      const result = await uc.execute({ quotationId });
      await queryClient.invalidateQueries({ queryKey: queryKeys.quotations() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
      return result;
    } catch (e: any) {
      const msg = e?.message || 'Failed to approve quotation';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, [invoiceRepo, repository, taskRepo, queryClient]);

  const declineQuotation = useCallback(async (quotationId: string): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const uc = new DeclineQuotationUseCase(repository, taskRepo);
      await uc.execute({ quotationId });
      await queryClient.invalidateQueries({ queryKey: queryKeys.quotations() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
    } catch (e: any) {
      const msg = e?.message || 'Failed to decline quotation';
      setError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  }, [repository, taskRepo, queryClient]);

  return {
    createQuotation,
    listQuotations,
    getQuotation,
    updateQuotation,
    deleteQuotation,
    approveQuotation,
    declineQuotation,
    /** Reactive quotations list — only populated when taskId option is provided */
    taskQuotations,
    loading,
    error,
  };
};
