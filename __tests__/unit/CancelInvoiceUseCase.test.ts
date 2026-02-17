import { Invoice } from '../../src/domain/entities/Invoice';
import { InvoiceRepository } from '../../src/domain/repositories/InvoiceRepository';
import { CancelInvoiceUseCase } from '../../src/application/usecases/invoice/CancelInvoiceUseCase';

describe('CancelInvoiceUseCase', () => {
  let mockRepo: InvoiceRepository;
  let useCase: CancelInvoiceUseCase;

  beforeEach(() => {
    mockRepo = {
      createInvoice: jest.fn(),
      getInvoice: jest.fn(),
      updateInvoice: jest.fn(),
      deleteInvoice: jest.fn(),
      findByExternalKey: jest.fn(),
      listInvoices: jest.fn(),
      assignProject: jest.fn(),
    } as unknown as InvoiceRepository;
    
    useCase = new CancelInvoiceUseCase(mockRepo);
  });

  describe('successful cancellations', () => {
    it('cancels a draft invoice', async () => {
      const draftInvoice: Invoice = {
        id: 'inv_1',
        total: 1000,
        currency: 'USD',
        status: 'draft',
        paymentStatus: 'unpaid',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      } as Invoice;

      const cancelledInvoice: Invoice = {
        ...draftInvoice,
        status: 'cancelled',
        metadata: expect.objectContaining({
          cancellationReason: 'No longer needed',
          statusHistory: expect.arrayContaining([
            expect.objectContaining({
              from: 'draft',
              to: 'cancelled',
              timestamp: expect.any(String),
              reason: 'No longer needed',
            }),
          ]),
        }),
      };

      (mockRepo.getInvoice as jest.Mock).mockResolvedValue(draftInvoice);
      (mockRepo.updateInvoice as jest.Mock).mockResolvedValue(cancelledInvoice);

      const result = await useCase.execute('inv_1', { reason: 'No longer needed' });

      expect(mockRepo.getInvoice).toHaveBeenCalledWith('inv_1');
      expect(mockRepo.updateInvoice).toHaveBeenCalledWith('inv_1', {
        status: 'cancelled',
        metadata: expect.objectContaining({
          cancellationReason: 'No longer needed',
          statusHistory: expect.any(Array),
        }),
      });
      expect(result.status).toBe('cancelled');
    });

    it('cancels an issued invoice', async () => {
      const issuedInvoice: Invoice = {
        id: 'inv_2',
        total: 500,
        currency: 'USD',
        status: 'issued',
        paymentStatus: 'unpaid',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-05T00:00:00Z',
      } as Invoice;

      const cancelledInvoice: Invoice = {
        ...issuedInvoice,
        status: 'cancelled',
      };

      (mockRepo.getInvoice as jest.Mock).mockResolvedValue(issuedInvoice);
      (mockRepo.updateInvoice as jest.Mock).mockResolvedValue(cancelledInvoice);

      const result = await useCase.execute('inv_2', { reason: 'Client requested cancellation' });

      expect(result.status).toBe('cancelled');
    });

    it('cancels an overdue invoice', async () => {
      const overdueInvoice: Invoice = {
        id: 'inv_3',
        total: 750,
        currency: 'USD',
        status: 'overdue',
        paymentStatus: 'unpaid',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-15T00:00:00Z',
      } as Invoice;

      const cancelledInvoice: Invoice = {
        ...overdueInvoice,
        status: 'cancelled',
      };

      (mockRepo.getInvoice as jest.Mock).mockResolvedValue(overdueInvoice);
      (mockRepo.updateInvoice as jest.Mock).mockResolvedValue(cancelledInvoice);

      const result = await useCase.execute('inv_3', { reason: 'Payment no longer required' });

      expect(result.status).toBe('cancelled');
    });

    it('stores cancellation reason in metadata', async () => {
      const invoice: Invoice = {
        id: 'inv_4',
        total: 850,
        currency: 'USD',
        status: 'draft',
        paymentStatus: 'unpaid',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      } as Invoice;

      (mockRepo.getInvoice as jest.Mock).mockResolvedValue(invoice);
      (mockRepo.updateInvoice as jest.Mock).mockImplementation((id, updates) => {
        return Promise.resolve({ ...invoice, ...updates });
      });

      await useCase.execute('inv_4', { reason: 'Duplicate invoice' });

      const updateCall = (mockRepo.updateInvoice as jest.Mock).mock.calls[0][1];
      expect(updateCall.metadata.cancellationReason).toBe('Duplicate invoice');
    });

    it('records timestamp in audit trail', async () => {
      const invoice: Invoice = {
        id: 'inv_5',
        total: 950,
        currency: 'USD',
        status: 'issued',
        paymentStatus: 'unpaid',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-03T00:00:00Z',
      } as Invoice;

      (mockRepo.getInvoice as jest.Mock).mockResolvedValue(invoice);
      (mockRepo.updateInvoice as jest.Mock).mockImplementation((id, updates) => {
        return Promise.resolve({ ...invoice, ...updates });
      });

      const beforeExecution = new Date().toISOString();
      await useCase.execute('inv_5', { reason: 'Error in invoice' });
      const afterExecution = new Date().toISOString();

      const updateCall = (mockRepo.updateInvoice as jest.Mock).mock.calls[0][1];
      expect(updateCall.metadata.statusHistory).toBeDefined();
      expect(updateCall.metadata.statusHistory[0].timestamp).toBeDefined();
      
      const recordedTimestamp = updateCall.metadata.statusHistory[0].timestamp;
      expect(recordedTimestamp >= beforeExecution && recordedTimestamp <= afterExecution).toBe(true);
    });

    it('accepts optional actor parameter for audit trail', async () => {
      const invoice: Invoice = {
        id: 'inv_6',
        total: 1100,
        currency: 'USD',
        status: 'draft',
        paymentStatus: 'unpaid',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-04T00:00:00Z',
      } as Invoice;

      (mockRepo.getInvoice as jest.Mock).mockResolvedValue(invoice);
      (mockRepo.updateInvoice as jest.Mock).mockImplementation((id, updates) => {
        return Promise.resolve({ ...invoice, ...updates });
      });

      await useCase.execute('inv_6', { reason: 'Cancelled by admin', actor: 'admin_456' });

      const updateCall = (mockRepo.updateInvoice as jest.Mock).mock.calls[0][1];
      expect(updateCall.metadata.statusHistory[0].actor).toBe('admin_456');
    });

    it('allows cancellation without a reason', async () => {
      const invoice: Invoice = {
        id: 'inv_7',
        total: 600,
        currency: 'USD',
        status: 'draft',
        paymentStatus: 'unpaid',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-05T00:00:00Z',
      } as Invoice;

      (mockRepo.getInvoice as jest.Mock).mockResolvedValue(invoice);
      (mockRepo.updateInvoice as jest.Mock).mockImplementation((id, updates) => {
        return Promise.resolve({ ...invoice, ...updates });
      });

      const result = await useCase.execute('inv_7');

      expect(result.status).toBe('cancelled');
      const updateCall = (mockRepo.updateInvoice as jest.Mock).mock.calls[0][1];
      expect(updateCall.metadata.cancellationReason).toBeUndefined();
    });
  });

  describe('validation', () => {
    it('throws error if invoice does not exist', async () => {
      (mockRepo.getInvoice as jest.Mock).mockResolvedValue(null);

      await expect(useCase.execute('inv_nonexistent')).rejects.toThrow(
        'Invoice with ID inv_nonexistent not found'
      );
    });

    it('throws error if invoice is already paid (MVP business rule)', async () => {
      const paidInvoice: Invoice = {
        id: 'inv_8',
        total: 300,
        currency: 'USD',
        status: 'paid',
        paymentStatus: 'paid',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-10T00:00:00Z',
      } as Invoice;

      (mockRepo.getInvoice as jest.Mock).mockResolvedValue(paidInvoice);

      await expect(useCase.execute('inv_8', { reason: 'Test' })).rejects.toThrow(
        'Cannot cancel a paid invoice'
      );
    });

    it('throws error if invoice is already cancelled', async () => {
      const cancelledInvoice: Invoice = {
        id: 'inv_9',
        total: 450,
        currency: 'USD',
        status: 'cancelled',
        paymentStatus: 'unpaid',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-12T00:00:00Z',
      } as Invoice;

      (mockRepo.getInvoice as jest.Mock).mockResolvedValue(cancelledInvoice);

      await expect(useCase.execute('inv_9', { reason: 'Test' })).rejects.toThrow(
        'Invoice is already cancelled'
      );
    });
  });

  describe('audit trail', () => {
    it('preserves existing metadata when adding cancellation info', async () => {
      const invoiceWithMetadata: Invoice = {
        id: 'inv_10',
        total: 700,
        currency: 'USD',
        status: 'issued',
        paymentStatus: 'unpaid',
        metadata: {
          customField: 'customValue',
          existingData: 456,
        },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-06T00:00:00Z',
      } as Invoice;

      (mockRepo.getInvoice as jest.Mock).mockResolvedValue(invoiceWithMetadata);
      (mockRepo.updateInvoice as jest.Mock).mockImplementation((id, updates) => {
        return Promise.resolve({ ...invoiceWithMetadata, ...updates });
      });

      await useCase.execute('inv_10', { reason: 'Cancelled' });

      const updateCall = (mockRepo.updateInvoice as jest.Mock).mock.calls[0][1];
      expect(updateCall.metadata.customField).toBe('customValue');
      expect(updateCall.metadata.existingData).toBe(456);
      expect(updateCall.metadata.statusHistory).toBeDefined();
    });

    it('appends to existing status history', async () => {
      const invoiceWithHistory: Invoice = {
        id: 'inv_11',
        total: 800,
        currency: 'USD',
        status: 'overdue',
        paymentStatus: 'unpaid',
        metadata: {
          statusHistory: [
            {
              from: 'draft',
              to: 'issued',
              timestamp: '2026-01-01T10:00:00Z',
              actor: 'user_001',
            },
            {
              from: 'issued',
              to: 'overdue',
              timestamp: '2026-01-15T00:00:00Z',
              actor: 'system',
            },
          ],
        },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-15T00:00:00Z',
      } as Invoice;

      (mockRepo.getInvoice as jest.Mock).mockResolvedValue(invoiceWithHistory);
      (mockRepo.updateInvoice as jest.Mock).mockImplementation((id, updates) => {
        return Promise.resolve({ ...invoiceWithHistory, ...updates });
      });

      await useCase.execute('inv_11', { reason: 'Not needed', actor: 'user_002' });

      const updateCall = (mockRepo.updateInvoice as jest.Mock).mock.calls[0][1];
      expect(updateCall.metadata.statusHistory.length).toBe(3);
      expect(updateCall.metadata.statusHistory[2]).toMatchObject({
        from: 'overdue',
        to: 'cancelled',
        actor: 'user_002',
        reason: 'Not needed',
      });
    });
  });
});
