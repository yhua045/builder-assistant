import renderer, { act } from 'react-test-renderer';
import React, { useEffect } from 'react';
import { waitFor } from '@testing-library/react-native';
import { container } from 'tsyringe';
import { useInvoices } from '../../hooks/useInvoices';
import { Invoice } from '../../../../domain/entities/Invoice';
import { wrapWithQuery, renderHookWithQuery } from '../../../../../__tests__/utils/queryClientWrapper';

describe('useInvoices hook', () => {
  const mockRepo: any = {
    listInvoices: jest.fn(),
    createInvoice: jest.fn(),
    updateInvoice: jest.fn(),
    deleteInvoice: jest.fn(),
    getInvoice: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(container, 'resolve').mockReturnValue(mockRepo);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Loading invoices', () => {
    it('loads invoices on mount (success)', async () => {
      const invoices: Invoice[] = [
        {
          id: 'inv_1',
          total: 1000,
          currency: 'USD',
          status: 'draft',
          paymentStatus: 'unpaid',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'inv_2',
          total: 2000,
          currency: 'USD',
          status: 'issued',
          paymentStatus: 'unpaid',
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
      ];

      mockRepo.listInvoices.mockResolvedValueOnce({ items: invoices, total: 2 });

      const { result } = renderHookWithQuery(() => useInvoices());

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBeNull();
      expect(result.current.invoices).toHaveLength(2);
      expect(result.current.invoices[0].id).toBe('inv_1');
      expect(mockRepo.listInvoices).toHaveBeenCalledTimes(1);
    });

    it('sets error when initial load fails', async () => {
      mockRepo.listInvoices.mockRejectedValueOnce(new Error('Database error'));

      const { result } = renderHookWithQuery(() => useInvoices());

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.invoices).toHaveLength(0);
      expect(result.current.error).toContain('Database error');
    });

    it('filters invoices by status', async () => {
      const invoices: Invoice[] = [
        {
          id: 'inv_1',
          total: 1000,
          currency: 'USD',
          status: 'draft',
          paymentStatus: 'unpaid',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        {
          id: 'inv_2',
          total: 2000,
          currency: 'USD',
          status: 'paid',
          paymentStatus: 'paid',
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z',
        },
      ];

      // Mock should filter based on status parameter
      mockRepo.listInvoices.mockImplementation((params?: any) => {
        const filtered = params?.status
          ? invoices.filter(inv => params.status.includes(inv.status))
          : invoices;
        return Promise.resolve({ items: filtered, total: filtered.length });
      });

      const { result } = renderHookWithQuery(() => useInvoices({ status: 'paid' }));

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.invoices).toHaveLength(1);
      expect(result.current.invoices[0].status).toBe('paid');
    });
  });

  describe('Create invoice', () => {
    it('creates invoice successfully and refreshes list', async () => {
      mockRepo.listInvoices
        .mockResolvedValueOnce({ items: [], total: 0 }) // initial load
        .mockResolvedValue({
          items: [
            {
              id: 'inv_new',
              total: 5000,
              currency: 'USD',
              status: 'draft',
              paymentStatus: 'unpaid',
              createdAt: '2024-01-03T00:00:00Z',
              updatedAt: '2024-01-03T00:00:00Z',
            },
          ],
          total: 1,
        }); // after create

      mockRepo.createInvoice.mockResolvedValueOnce(undefined);

      let latest: any = null;

      function TestHarness() {
        const state = useInvoices();
        useEffect(() => {
          latest = state;
        }, [state]);
        return null;
      }

      await act(async () => {
        renderer.create(wrapWithQuery(<TestHarness />));
        for (let i = 0; i < 20; i++) {
          if (latest && latest.loading === false) break;
          await new Promise<void>(resolve => setTimeout(resolve, 50));
        }
      });

      expect(latest.invoices).toHaveLength(0);

      await act(async () => {
        const result = await latest.createInvoice({
          total: 5000,
          currency: 'USD',
        });

        expect(result.success).toBe(true);

        // Wait for list to refresh
        for (let i = 0; i < 20; i++) {
          if (latest.invoices.length > 0) break;
          await new Promise<void>(resolve => setTimeout(resolve, 50));
        }
      });

      expect(latest.invoices).toHaveLength(1);
      expect(latest.invoices[0].id).toBe('inv_new');
      expect(mockRepo.createInvoice).toHaveBeenCalledTimes(1);
    });

    it('handles create errors gracefully', async () => {
      mockRepo.listInvoices.mockResolvedValueOnce({ items: [], total: 0 });
      mockRepo.createInvoice.mockRejectedValueOnce(new Error('Save failed'));

      let latest: any = null;

      function TestHarness() {
        const state = useInvoices();
        useEffect(() => {
          latest = state;
        }, [state]);
        return null;
      }

      await act(async () => {
        renderer.create(wrapWithQuery(<TestHarness />));
        for (let i = 0; i < 20; i++) {
          if (latest && latest.loading === false) break;
          await new Promise<void>(resolve => setTimeout(resolve, 50));
        }
      });

      await act(async () => {
        const result = await latest.createInvoice({
          total: 5000,
          currency: 'USD',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('Save failed');
      });
    });
  });

  describe('Update invoice', () => {
    it('updates invoice successfully and refreshes list', async () => {
      const invoice: Invoice = {
        id: 'inv_1',
        total: 1000,
        currency: 'USD',
        status: 'draft',
        paymentStatus: 'unpaid',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockRepo.listInvoices
        .mockResolvedValueOnce({ items: [invoice], total: 1 }) // initial
        .mockResolvedValue({
          items: [
            {
              ...invoice,
              total: 1500,
              updatedAt: '2024-01-02T00:00:00Z',
            },
          ],
          total: 1,
        }); // after update

      mockRepo.updateInvoice.mockResolvedValueOnce(undefined);

      const { result } = renderHookWithQuery(() => useInvoices());

      await waitFor(() => expect(result.current.invoices[0]?.total).toBe(1000));

      await act(async () => {
        const updateResult = await result.current.updateInvoice({
          ...invoice,
          total: 1500,
        });
        expect(updateResult.success).toBe(true);
      });

      await waitFor(() => expect(result.current.invoices[0]?.total).toBe(1500));
    });
  });

  describe('Delete invoice', () => {
    it('deletes invoice successfully and refreshes list', async () => {
      const invoice: Invoice = {
        id: 'inv_1',
        total: 1000,
        currency: 'USD',
        status: 'draft',
        paymentStatus: 'unpaid',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockRepo.listInvoices
        .mockResolvedValueOnce({ items: [invoice], total: 1 }) // initial
        .mockResolvedValue({ items: [], total: 0 }); // after delete

      mockRepo.deleteInvoice.mockResolvedValueOnce(undefined);

      const { result } = renderHookWithQuery(() => useInvoices());

      await waitFor(() => expect(result.current.invoices).toHaveLength(1));

      await act(async () => {
        const deleteResult = await result.current.deleteInvoice('inv_1');
        expect(deleteResult.success).toBe(true);
      });

      await waitFor(() => expect(result.current.invoices).toHaveLength(0));
      expect(mockRepo.deleteInvoice).toHaveBeenCalledWith('inv_1');
    });
  });

  describe('Get invoice by ID', () => {
    it('fetches invoice by ID successfully', async () => {
      const invoice: Invoice = {
        id: 'inv_1',
        total: 1000,
        currency: 'USD',
        status: 'draft',
        paymentStatus: 'unpaid',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      mockRepo.listInvoices.mockResolvedValueOnce({ items: [], total: 0 });
      mockRepo.getInvoice.mockResolvedValueOnce(invoice);

      let latest: any = null;

      function TestHarness() {
        const state = useInvoices();
        useEffect(() => {
          latest = state;
        }, [state]);
        return null;
      }

      await act(async () => {
        renderer.create(wrapWithQuery(<TestHarness />));
        for (let i = 0; i < 20; i++) {
          if (latest && latest.loading === false) break;
          await new Promise<void>(resolve => setTimeout(resolve, 50));
        }
      });

      let fetchedInvoice: Invoice | null = null;

      await act(async () => {
        fetchedInvoice = (await latest.getInvoiceById('inv_1')) as Invoice | null;
      });

      expect(fetchedInvoice).not.toBeNull();
      expect(fetchedInvoice).toEqual(
        expect.objectContaining({ id: 'inv_1', total: 1000 })
      );
      expect(mockRepo.getInvoice).toHaveBeenCalledWith('inv_1');
    });

    it('returns null when invoice not found', async () => {
      mockRepo.listInvoices.mockResolvedValueOnce({ items: [], total: 0 });
      mockRepo.getInvoice.mockResolvedValueOnce(null);

      let latest: any = null;

      function TestHarness() {
        const state = useInvoices();
        useEffect(() => {
          latest = state;
        }, [state]);
        return null;
      }

      await act(async () => {
        renderer.create(wrapWithQuery(<TestHarness />));
        for (let i = 0; i < 20; i++) {
          if (latest && latest.loading === false) break;
          await new Promise<void>(resolve => setTimeout(resolve, 50));
        }
      });

      let fetchedInvoice: Invoice | null = null;

      await act(async () => {
        fetchedInvoice = await latest.getInvoiceById('non_existent');
      });

      expect(fetchedInvoice).toBeNull();
    });
  });

  describe('Refresh invoices', () => {
    it('manually refreshes invoice list', async () => {
      mockRepo.listInvoices
        .mockResolvedValueOnce({ items: [], total: 0 }) // initial
        .mockResolvedValue({
          items: [
            {
              id: 'inv_1',
              total: 1000,
              currency: 'USD',
              status: 'draft',
              paymentStatus: 'unpaid',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          total: 1,
        }); // after refresh

      let latest: any = null;

      function TestHarness() {
        const state = useInvoices();
        useEffect(() => {
          latest = state;
        }, [state]);
        return null;
      }

      await act(async () => {
        renderer.create(wrapWithQuery(<TestHarness />));
        for (let i = 0; i < 20; i++) {
          if (latest && latest.loading === false) break;
          await new Promise<void>(resolve => setTimeout(resolve, 50));
        }
      });

      expect(latest.invoices).toHaveLength(0);

      await act(async () => {
        await latest.refreshInvoices();

        // Wait for refresh to complete
        for (let i = 0; i < 20; i++) {
          if (latest.invoices.length > 0) break;
          await new Promise<void>(resolve => setTimeout(resolve, 50));
        }
      });

      expect(latest.invoices).toHaveLength(1);
      expect(mockRepo.listInvoices).toHaveBeenCalledTimes(2);
    });
  });
});
