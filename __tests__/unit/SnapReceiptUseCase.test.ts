import { SnapReceiptUseCase, SnapReceiptDTO } from '../../src/application/usecases/receipt/SnapReceiptUseCase';
import { ReceiptRepository } from '../../src/domain/repositories/ReceiptRepository';
import { IOcrAdapter, OcrResult } from '../../src/application/services/IOcrAdapter';
import { ReceiptFieldParser, ReceiptCandidates } from '../../src/application/receipt/ReceiptFieldParser';
import { IReceiptNormalizer, NormalizedReceipt } from '../../src/application/receipt/IReceiptNormalizer';
// removed unused entity imports

describe('SnapReceiptUseCase', () => {
    let mockReceiptRepo: ReceiptRepository;
    let useCase: SnapReceiptUseCase;

    beforeEach(() => {
        mockReceiptRepo = {
            createReceipt: jest.fn().mockImplementation(async (inv, pay) => ({ invoice: inv, payment: pay })),
        } as unknown as ReceiptRepository;

        useCase = new SnapReceiptUseCase(mockReceiptRepo);
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
        expect(mockReceiptRepo.createReceipt).toHaveBeenCalledTimes(1);
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

    describe('OCR Pipeline Integration', () => {
        let mockOcrAdapter: IOcrAdapter;
        let mockFieldParser: ReceiptFieldParser;
        let mockNormalizer: IReceiptNormalizer;
        let useCaseWithOcr: SnapReceiptUseCase;

        beforeEach(() => {
            mockOcrAdapter = {
                extractText: jest.fn()
            } as unknown as IOcrAdapter;

            mockFieldParser = {
                parse: jest.fn()
            } as unknown as ReceiptFieldParser;

            mockNormalizer = {
                normalize: jest.fn()
            } as unknown as IReceiptNormalizer;

            useCaseWithOcr = new SnapReceiptUseCase(
                mockReceiptRepo,
                mockOcrAdapter,
                mockFieldParser,
                mockNormalizer
            );
        });

        it('processReceipt() calls OCR adapter with image URI', async () => {
            const mockOcrResult: OcrResult = {
                fullText: 'Home Depot\nTotal $100.00',
                tokens: [],
                imageUri: 'file:///test.jpg'
            };

            const mockCandidates: ReceiptCandidates = {
                vendors: ['Home Depot'],
                dates: [new Date('2026-02-10')],
                amounts: [100.00],
                taxAmounts: [],
                receiptNumbers: [],
                lineItems: []
            };

            const mockNormalized: NormalizedReceipt = {
                vendor: 'Home Depot',
                date: new Date('2026-02-10'),
                total: 100.00,
                tax: null,
                currency: 'USD',
                receiptNumber: null,
                lineItems: [],
                confidence: { overall: 0.8, vendor: 0.9, date: 0.8, total: 0.9 },
                suggestedCorrections: []
            };

            (mockOcrAdapter.extractText as jest.Mock).mockResolvedValue(mockOcrResult);
            (mockFieldParser.parse as jest.Mock).mockReturnValue(mockCandidates);
            (mockNormalizer.normalize as jest.Mock).mockResolvedValue(mockNormalized);

            const result = await useCaseWithOcr.processReceipt('file:///test.jpg');

            expect(mockOcrAdapter.extractText).toHaveBeenCalledWith('file:///test.jpg');
            expect(mockFieldParser.parse).toHaveBeenCalledWith(mockOcrResult);
            expect(mockNormalizer.normalize).toHaveBeenCalledWith(mockCandidates, mockOcrResult);
            expect(result).toEqual(mockNormalized);
        });

        it('processReceipt() throws error if OCR pipeline not configured', async () => {
            const useCaseWithoutOcr = new SnapReceiptUseCase(mockReceiptRepo);

            await expect(useCaseWithoutOcr.processReceipt('file:///test.jpg'))
                .rejects.toThrow('OCR pipeline not configured');
        });

        it('saveReceipt() creates invoice with normalized fields', async () => {
            const normalizedReceipt: NormalizedReceipt = {
                vendor: 'Home Depot',
                date: new Date('2026-02-10'),
                total: 100.00,
                tax: 10.00,
                currency: 'USD',
                receiptNumber: 'INV-123',
                lineItems: [],
                confidence: { overall: 0.8, vendor: 0.9, date: 0.8, total: 0.9 },
                suggestedCorrections: ['Check tax amount']
            };

            const result = await useCaseWithOcr.saveReceipt(
                normalizedReceipt,
                'cash',
                'proj-123'
            );

            expect(result.invoice).toBeDefined();
            expect(result.payment).toBeDefined();
            expect(result.invoice.issuerName).toBe('Home Depot');
            expect(result.invoice.total).toBe(100.00);
            expect(result.invoice.projectId).toBe('proj-123');
            expect(result.payment.amount).toBe(100.00);
            expect(result.payment.method).toBe('cash');
            expect(mockReceiptRepo.createReceipt).toHaveBeenCalled();
        });
    });
});
