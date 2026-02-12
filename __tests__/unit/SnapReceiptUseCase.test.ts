import { SnapReceiptUseCase, SnapReceiptDTO } from '../../src/application/usecases/receipt/SnapReceiptUseCase';
import { InvoiceRepository } from '../../src/domain/repositories/InvoiceRepository';
import { PaymentRepository } from '../../src/domain/repositories/PaymentRepository';
// removed unused entity imports

describe('SnapReceiptUseCase', () => {
    let mockInvoiceRepo: InvoiceRepository;
    let mockPaymentRepo: PaymentRepository;
    let useCase: SnapReceiptUseCase;

    beforeEach(() => {
        mockInvoiceRepo = {
            createInvoice: jest.fn().mockImplementation(async (inv) => inv),
            assignProject: jest.fn(),
            getInvoice: jest.fn(),
            updateInvoice: jest.fn(),
            deleteInvoice: jest.fn(),
            findByExternalKey: jest.fn(),
            listInvoices: jest.fn(),
        } as unknown as InvoiceRepository;

        mockPaymentRepo = {
            save: jest.fn().mockImplementation(async (_pay) => undefined),
            getPayment: jest.fn(),
            updatePayment: jest.fn(),
            deletePayment: jest.fn(),
            listPayments: jest.fn(),
            findByInvoice: jest.fn().mockResolvedValue([]),
        } as unknown as PaymentRepository;

        useCase = new SnapReceiptUseCase(mockInvoiceRepo, mockPaymentRepo);
    });

    it('creates an invoice and payment from valid receipt data', async () => {
        // initial unused input removed; using validInput below
        const validInput: SnapReceiptDTO = {
            vendor: 'Bunnings',
            amount: 150.50,
            date: '2023-10-27T10:00:00Z',
            paymentMethod: 'other', // matching 'other'
            projectId: 'proj-123',
            notes: 'Some supplies',
            currency: 'AUD'
        };

        const result = await useCase.execute(validInput);

        expect(result.invoice).toBeDefined();
        expect(result.payment).toBeDefined();

        // Invoice Check
        expect(result.invoice.issuerName).toBe('Bunnings');
        expect(result.invoice.total).toBe(150.50);
        expect(result.invoice.dateIssued).toBe(validInput.date);
        expect(result.invoice.paymentDate).toBe(validInput.date);
        expect(result.invoice.status).toBe('paid');
        expect(result.invoice.paymentStatus).toBe('paid');
        expect(result.invoice.projectId).toBe('proj-123');
        expect(result.invoice.notes).toBe('Some supplies');

        // Payment Check
        expect(result.payment.amount).toBe(150.50);
        expect(result.payment.method).toBe('other');
        expect(result.payment.projectId).toBe('proj-123');
        expect(result.payment.invoiceId).toBe(result.invoice.id);
        expect(result.payment.date).toBe(validInput.date);
        
        // Repo calls
        expect(mockInvoiceRepo.createInvoice).toHaveBeenCalledTimes(1);
        expect(mockPaymentRepo.save).toHaveBeenCalledTimes(1);
    });

    it('throws error if amount is invalid', async () => {
        const invalidInput: SnapReceiptDTO = {
            vendor: 'Bunnings',
            amount: -10,
            date: new Date().toISOString(),
            paymentMethod: 'cash'
        };
        await expect(useCase.execute(invalidInput)).rejects.toThrow('Amount must be positive');
    });
});
