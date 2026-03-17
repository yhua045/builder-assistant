/**
 * Custom hook for managing invoice data and operations
 */

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Invoice, InvoiceEntity } from '../domain/entities/Invoice';
import { InvoiceRepository } from '../domain/repositories/InvoiceRepository';
import { container } from 'tsyringe';
import '../infrastructure/di/registerServices';
import { CreateInvoiceUseCase } from '../application/usecases/invoice/CreateInvoiceUseCase';
import { UpdateInvoiceUseCase } from '../application/usecases/invoice/UpdateInvoiceUseCase';
import { DeleteInvoiceUseCase } from '../application/usecases/invoice/DeleteInvoiceUseCase';
import { GetInvoiceByIdUseCase } from '../application/usecases/invoice/GetInvoiceByIdUseCase';
import { ListInvoicesUseCase } from '../application/usecases/invoice/ListInvoicesUseCase';
import { queryKeys, invalidations } from './queryKeys';

export interface UseInvoicesOptions {
  status?: Invoice['status'];
  projectId?: string;
}

export interface UseInvoicesReturn {
  invoices: Invoice[];
  loading: boolean;
  error: string | null;
  createInvoice: (
    invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<{ success: boolean; error?: string }>;
  updateInvoice: (invoice: Invoice) => Promise<{ success: boolean; error?: string }>;
  deleteInvoice: (id: string) => Promise<{ success: boolean; error?: string }>;
  getInvoiceById: (id: string) => Promise<Invoice | null>;
  refreshInvoices: () => Promise<void>;
}

export const useInvoices = (options?: UseInvoicesOptions): UseInvoicesReturn => {
  const queryClient = useQueryClient();

  // Resolve repository via DI container and construct use cases
  const repository = useMemo(
    () => container.resolve<InvoiceRepository>('InvoiceRepository'),
    []
  );

  const createInvoiceUseCase = useMemo(
    () => new CreateInvoiceUseCase(repository),
    [repository]
  );
  const updateInvoiceUseCase = useMemo(
    () => new UpdateInvoiceUseCase(repository),
    [repository]
  );
  const deleteInvoiceUseCase = useMemo(
    () => new DeleteInvoiceUseCase(repository),
    [repository]
  );
  const getInvoiceByIdUseCase = useMemo(
    () => new GetInvoiceByIdUseCase(repository),
    [repository]
  );
  const listInvoicesUseCase = useMemo(
    () => new ListInvoicesUseCase(repository),
    [repository]
  );

  const queryKey = queryKeys.invoices(options?.projectId);

  const {
    data: invoices = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery<Invoice[]>({
    queryKey,
    queryFn: async () => {
      const result = await listInvoicesUseCase.execute({
        status: options?.status ? [options.status] : undefined,
        projectId: options?.projectId,
      });
      return result.items;
    },
    staleTime: 60_000,
  });

  const error = queryError instanceof Error ? queryError.message : null;

  const createInvoice = useCallback(
    async (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => {
      try {
        // Ensure domain entity generates required defaults (id, timestamps, status, currency)
        const entity = InvoiceEntity.create(invoice as any);
        await createInvoiceUseCase.execute(entity.data());
        await Promise.all(
          invalidations.invoiceMutated({ projectId: options?.projectId })
            .map(key => queryClient.invalidateQueries({ queryKey: key }))
        );
        return { success: true };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to create invoice';
        return { success: false, error: errorMsg };
      }
    },
    [createInvoiceUseCase, queryClient, options?.projectId]
  );

  const updateInvoice = useCallback(
    async (invoice: Invoice) => {
      try {
        await updateInvoiceUseCase.execute(invoice.id, invoice);
        await Promise.all(
          invalidations.invoiceMutated({ projectId: options?.projectId })
            .map(key => queryClient.invalidateQueries({ queryKey: key }))
        );
        return { success: true };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to update invoice';
        return { success: false, error: errorMsg };
      }
    },
    [updateInvoiceUseCase, queryClient, options?.projectId]
  );

  const deleteInvoice = useCallback(
    async (id: string) => {
      try {
        await deleteInvoiceUseCase.execute(id);
        await Promise.all(
          invalidations.invoiceMutated({ projectId: options?.projectId })
            .map(key => queryClient.invalidateQueries({ queryKey: key }))
        );
        return { success: true };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to delete invoice';
        return { success: false, error: errorMsg };
      }
    },
    [deleteInvoiceUseCase, queryClient, options?.projectId]
  );

  const getInvoiceById = useCallback(
    async (id: string): Promise<Invoice | null> => {
      try {
        const invoice = await getInvoiceByIdUseCase.execute(id);
        return invoice;
      } catch (err) {
        return null;
      }
    },
    [getInvoiceByIdUseCase]
  );

  const refreshInvoices = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    invoices,
    loading,
    error,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    getInvoiceById,
    refreshInvoices,
  };
};
