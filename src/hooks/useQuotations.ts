import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Quotation } from '../domain/entities/Quotation';
import { QuotationRepository, QuotationFilterParams } from '../domain/repositories/QuotationRepository';
import { CreateQuotationUseCase } from '../application/usecases/quotation/CreateQuotationUseCase';
import { ListQuotationsUseCase } from '../application/usecases/quotation/ListQuotationsUseCase';
import { GetQuotationByIdUseCase } from '../application/usecases/quotation/GetQuotationByIdUseCase';
import { UpdateQuotationUseCase } from '../application/usecases/quotation/UpdateQuotationUseCase';
import { DeleteQuotationUseCase } from '../application/usecases/quotation/DeleteQuotationUseCase';
import { DrizzleQuotationRepository } from '../infrastructure/repositories/DrizzleQuotationRepository';
import { queryKeys } from './queryKeys';

export interface UseQuotationsOptions {
  /** When provided, subscribes reactively to quotations for this task */
  taskId?: string;
}

export const useQuotations = (options?: UseQuotationsOptions) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const repository = useMemo<QuotationRepository>(() => new DrizzleQuotationRepository(), []);

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
      const created = await createQuotationUC.execute(quotation as Quotation);
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

  return {
    createQuotation,
    listQuotations,
    getQuotation,
    updateQuotation,
    deleteQuotation,
    /** Reactive quotations list — only populated when taskId option is provided */
    taskQuotations,
    loading,
    error,
  };
};
