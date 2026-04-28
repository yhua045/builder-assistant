import { Invoice } from '../../../../domain/entities/Invoice';
import { InvoiceRepository } from '../../../../domain/repositories/InvoiceRepository';
import { MarkInvoiceAsPaidUseCase } from '../../application/MarkInvoiceAsPaidUseCase';

describe('MarkInvoiceAsPaidUseCase', () => {
  let mockRepo: InvoiceRepository;
  let useCase: MarkInvoiceAsPaidUseCase;

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
    
    useCase = new MarkInvoiceAsPaidUseCase(mockRepo);
  });

  describe('successful transitions', () => {
    it('marks an "issued" invoice as paid', async () => {
      const issuedInvoice: Invoice = {
        id: 'inv_1',
        total: 1000,
        currency: 'USD',
        status: 'issued',
        paymentStatus: 'unpaid',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      } as Invoice;

      const paidInvoice: Invoice = {
        ...issuedInvoice,
        status: 'paid',
        paymentStatus: 'paid',
        paymentDate: expect.any(String),
        metadata: expect.objectContaining({
          statusHistory: expect.arrayContaining([
            expect.objectContaining({
              from: 'issued',
              to: 'paid',
              timestamp: expect.any(String),
            }),
          ]),
        }),
      };

      (mockRepo.getInvoice as jest.Mock).mockResolvedValue(issuedInvoice);
      (mockRepo.updateInvoice as jest.Mock).mockResolvedValue(paidInvoice);

      const result = await useCase.execute('inv_1');

      expect(mockRepo.getInvoice).toHaveBeenCalledWith('inv_1');
      expect(mockRepo.updateInvoice).toHaveBeenCalledWith('inv_1', {
        status: 'paid',
        paymentStatus: 'paid',
        paymentDate: expect.any(String),
        metadata: expect.objectContaining({
          statusHistory: expect.any(Array),
        }),
      });
      expect(result.status).toBe('paid');
      expect(result.paymentStatus).toBe('paid');
    });

    it('marks an "overdue" invoice as paid', async () => {
      const overdueInvoice: Invoice = {
        id: 'inv_2',
        total: 500,
        currency: 'USD',
        status: 'overdue',
        paymentStatus: 'unpaid',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-15T00:00:00Z',
      } as Invoice;

      const paidInvoice: Invoice = {
        ...overdueInvoice,
        status: 'paid',
        paymentStatus: 'paid',
      };

      (mockRepo.getInvoice as jest.Mock).mockResolvedValue(overdueInvoice);
      (mockRepo.updateInvoice as jest.Mock).mockResolvedValue(paidInvoice);

      const result = await useCase.execute('inv_2');

      expect(result.status).toBe('paid');
      expect(result.paymentStatus).toBe('paid');
    });

    it('records timestamp in audit trail', async () => {
      const issuedInvoice: Invoice = {
        id: 'inv_3',
        total: 750,
        currency: 'USD',
        status: 'issued',
        paymentStatus: 'unpaid',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      } as Invoice;

      (mockRepo.getInvoice as jest.Mock).mockResolvedValue(issuedInvoice);
      (mockRepo.updateInvoice as jest.Mock).mockImplementation((id, updates) => {
        return Promise.resolve({ ...issuedInvoice, ...updates });
      });

      const beforeExecution = new Date().toISOString();
      await useCase.execute('inv_3');
      const afterExecution = new Date().toISOString();

      const updateCall = (mockRepo.updateInvoice as jest.Mock).mock.calls[0][1];
      expect(updateCall.metadata.statusHistory).toBeDefined();
      expect(updateCall.metadata.statusHistory[0].timestamp).toBeDefined();
      
      const recordedTimestamp = updateCall.metadata.statusHistory[0].timestamp;
      expect(recordedTimestamp >= beforeExecution && recordedTimestamp <= afterExecution).toBe(true);
    });

    it('accepts optional actor parameter for audit trail', async () => {
      const issuedInvoice: Invoice = {
        id: 'inv_4',
        total: 1200,
        currency: 'USD',
        status: 'issued',
        paymentStatus: 'unpaid',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      } as Invoice;

      (mockRepo.getInvoice as jest.Mock).mockResolvedValue(issuedInvoice);
      (mockRepo.updateInvoice as jest.Mock).mockImplementation((id, updates) => {
        return Promise.resolve({ ...issuedInvoice, ...updates });
      });

      await useCase.execute('inv_4', { actor: 'user_123' });

      const updateCall = (mockRepo.updateInvoice as jest.Mock).mock.calls[0][1];
      expect(updateCall.metadata.statusHistory[0].actor).toBe('user_123');
    });
  });

  describe('validation', () => {
    it('throws error if invoice does not exist', async () => {
      (mockRepo.getInvoice as jest.Mock).mockResolvedValue(null);

      await expect(useCase.execute('inv_nonexistent')).rejects.toThrow(
        'Invoice with ID inv_nonexistent not found'
      );
    });

    it('throws error if invoice is already paid', async () => {
      const alreadyPaidInvoice: Invoice = {
        id: 'inv_5',
        total: 300,
        currency: 'USD',
        status: 'paid',
        paymentStatus: 'paid',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-10T00:00:00Z',
      } as Invoice;

      (mockRepo.getInvoice as jest.Mock).mockResolvedValue(alreadyPaidInvoice);

      await expect(useCase.execute('inv_5')).rejects.toThrow(
        'Invoice is already marked as paid'
      );
    });

    it('throws error if invoice is cancelled', async () => {
      const cancelledInvoice: Invoice = {
        id: 'inv_6',
        total: 450,
        currency: 'USD',
        status: 'cancelled',
        paymentStatus: 'unpaid',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-12T00:00:00Z',
      } as Invoice;

      (mockRepo.getInvoice as jest.Mock).mockResolvedValue(cancelledInvoice);

      await expect(useCase.execute('inv_6')).rejects.toThrow(
        'Cannot mark a cancelled invoice as paid'
      );
    });

    it('throws error if invoice is in draft status', async () => {
      const draftInvoice: Invoice = {
        id: 'inv_7',
        total: 600,
        currency: 'USD',
        status: 'draft',
        paymentStatus: 'unpaid',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      } as Invoice;

      (mockRepo.getInvoice as jest.Mock).mockResolvedValue(draftInvoice);

      await expect(useCase.execute('inv_7')).rejects.toThrow(
        'Only issued or overdue invoices can be marked as paid'
      );
    });
  });

  describe('audit trail', () => {
    it('preserves existing metadata when adding status history', async () => {
      const invoiceWithMetadata: Invoice = {
        id: 'inv_8',
        total: 850,
        currency: 'USD',
        status: 'issued',
        paymentStatus: 'unpaid',
        metadata: {
          customField: 'customValue',
          existingData: 123,
        },
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-05T00:00:00Z',
      } as Invoice;

      (mockRepo.getInvoice as jest.Mock).mockResolvedValue(invoiceWithMetadata);
      (mockRepo.updateInvoice as jest.Mock).mockImplementation((id, updates) => {
        return Promise.resolve({ ...invoiceWithMetadata, ...updates });
      });

      await useCase.execute('inv_8');

      const updateCall = (mockRepo.updateInvoice as jest.Mock).mock.calls[0][1];
      expect(updateCall.metadata.customField).toBe('customValue');
      expect(updateCall.metadata.existingData).toBe(123);
      expect(updateCall.metadata.statusHistory).toBeDefined();
    });

    it('appends to existing status history', async () => {
      const invoiceWithHistory: Invoice = {
        id: 'inv_9',
        total: 950,
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

      await useCase.execute('inv_9', { actor: 'user_002' });

      const updateCall = (mockRepo.updateInvoice as jest.Mock).mock.calls[0][1];
      expect(updateCall.metadata.statusHistory.length).toBe(3);
      expect(updateCall.metadata.statusHistory[2]).toMatchObject({
        from: 'overdue',
        to: 'paid',
        actor: 'user_002',
      });
    });
  });
});
