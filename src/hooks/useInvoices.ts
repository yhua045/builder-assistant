/**
 * Custom hook for managing invoice data and operations
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Invoice } from '../domain/entities/Invoice';
import { InvoiceRepository } from '../domain/repositories/InvoiceRepository';
import { container } from 'tsyringe';
import '../infrastructure/di/registerServices';
import { CreateInvoiceUseCase } from '../application/usecases/invoice/CreateInvoiceUseCase';
import { UpdateInvoiceUseCase } from '../application/usecases/invoice/UpdateInvoiceUseCase';
import { DeleteInvoiceUseCase } from '../application/usecases/invoice/DeleteInvoiceUseCase';
import { GetInvoiceByIdUseCase } from '../application/usecases/invoice/GetInvoiceByIdUseCase';
import { ListInvoicesUseCase } from '../application/usecases/invoice/ListInvoicesUseCase';

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
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const loadInvoices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Call list use case with optional filters
      const result = await listInvoicesUseCase.execute({
        status: options?.status ? [options.status] : undefined,
        projectId: options?.projectId,
      });

      setInvoices(result.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invoices');
    } finally {
      setLoading(false);
    }
  }, [listInvoicesUseCase, options?.status, options?.projectId]);

  const createInvoice = useCallback(
    async (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => {
      try {
        await createInvoiceUseCase.execute(invoice as Invoice);
        await loadInvoices(); // Refresh list
        return { success: true };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to create invoice';
        return { success: false, error: errorMsg };
      }
    },
    [createInvoiceUseCase, loadInvoices]
  );

  const updateInvoice = useCallback(
    async (invoice: Invoice) => {
      try {
        await updateInvoiceUseCase.execute(invoice.id, invoice);
        await loadInvoices(); // Refresh list
        return { success: true };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to update invoice';
        return { success: false, error: errorMsg };
      }
    },
    [updateInvoiceUseCase, loadInvoices]
  );

  const deleteInvoice = useCallback(
    async (id: string) => {
      try {
        await deleteInvoiceUseCase.execute(id);
        await loadInvoices(); // Refresh list
        return { success: true };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to delete invoice';
        return { success: false, error: errorMsg };
      }
    },
    [deleteInvoiceUseCase, loadInvoices]
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
    await loadInvoices();
  }, [loadInvoices]);

  // Load invoices on mount
  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

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
