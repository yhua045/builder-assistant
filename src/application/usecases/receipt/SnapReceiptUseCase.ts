import { Invoice, InvoiceEntity } from '../../../domain/entities/Invoice';
import { Payment, PaymentEntity } from '../../../domain/entities/Payment';
import { ReceiptRepository } from '../../../domain/repositories/ReceiptRepository';
import { IOcrAdapter } from '../../services/IOcrAdapter';
import { ReceiptFieldParser } from '../../receipt/ReceiptFieldParser';
import { IReceiptNormalizer, NormalizedReceipt } from '../../receipt/IReceiptNormalizer';

export interface SnapReceiptDTO {
  vendor: string;
  amount: number;
  date: string;
  paymentMethod: Payment['method'];
  projectId?: string;
  category?: string;
  currency?: string;
  notes?: string;
}

export class SnapReceiptUseCase {
  constructor(
    private readonly receiptRepo: ReceiptRepository,
    private readonly ocrAdapter?: IOcrAdapter,
    private readonly fieldParser?: ReceiptFieldParser,
    private readonly normalizer?: IReceiptNormalizer
  ) {}

  async execute(input: SnapReceiptDTO): Promise<{ invoice: Invoice; payment: Payment }> {
    if (input.amount <= 0) {
      throw new Error('Amount must be positive');
    }
    if (!input.vendor) {
        throw new Error('Vendor is required');
    }
    if (!input.date) {
        throw new Error('Date is required');
    }

    // 1. Create Invoice
    const invoiceEntity = InvoiceEntity.create({
      issuerName: input.vendor,
      total: input.amount,
      currency: input.currency || 'USD', // Default to USD or App settings
      status: 'paid', // Immediately paid
      paymentStatus: 'paid',
      dateIssued: input.date,
      paymentDate: input.date, // Paid on same day
      projectId: input.projectId,
      notes: input.notes,
      // We might want to store category in metadata or tags
      metadata: input.category ? { category: input.category } : undefined
    });

    const invoice = invoiceEntity.data();

    // 2. Create Payment
    const paymentEntity = PaymentEntity.create({
      amount: input.amount,
      date: input.date,
      projectId: input.projectId,
      invoiceId: invoice.id,
      method: input.paymentMethod,
      currency: input.currency || 'USD',
      status: 'settled',
      notes: input.notes
    });

    // Check if Payment project ID is problematic
    const payment = paymentEntity.data();
    if (!payment.projectId && !input.projectId) {
        // If unknown project, what to do?
        // Maybe we don't enforce it here, but repo might complain.
        // Or we pass undefined/null if repo supports it.
        // Payment interface validation is what matters.
    }

    // 3. Persist atomically
    try {
      return await this.receiptRepo.createReceipt(invoice, payment);
    } catch (error) {
      throw new Error('Failed to save receipt');
    }
  }

  /**
   * Process receipt image through OCR pipeline
   * @param imageUri - Local file URI or base64 image
   * @returns Normalized receipt data for review
   * @throws Error if OCR pipeline is not configured or processing fails
   */
  async processReceipt(imageUri: string): Promise<NormalizedReceipt> {
    if (!this.ocrAdapter || !this.fieldParser || !this.normalizer) {
      throw new Error('OCR pipeline not configured. Please provide ocrAdapter, fieldParser, and normalizer in constructor.');
    }

    try {
      // Step 1: Extract text via OCR
      const ocrResult = await this.ocrAdapter.extractText(imageUri);
      
      // Step 2: Parse candidates from OCR text
      const candidates = this.fieldParser.parse(ocrResult);
      
      // Step 3: Normalize candidates into structured receipt
      const normalized = await this.normalizer.normalize(candidates, ocrResult);
      
      return normalized;
    } catch (error) {
      throw new Error(`Failed to process receipt: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save normalized receipt as invoice + payment
   * @param normalizedReceipt - Normalized receipt from processReceipt()
   * @param paymentMethod - Payment method to use
   * @param projectId - Optional project to associate with
   * @returns Created invoice and payment
   */
  async saveReceipt(
    normalizedReceipt: NormalizedReceipt,
    paymentMethod: Payment['method'],
    projectId?: string
  ): Promise<{ invoice: Invoice; payment: Payment }> {
    // Convert NormalizedReceipt to SnapReceiptDTO
    const dto: SnapReceiptDTO = {
      vendor: normalizedReceipt.vendor || 'Unknown Vendor',
      amount: normalizedReceipt.total || 0,
      date: normalizedReceipt.date?.toISOString() || new Date().toISOString(),
      paymentMethod,
      projectId,
      currency: normalizedReceipt.currency,
      notes: normalizedReceipt.suggestedCorrections.length > 0 
        ? `OCR Suggestions: ${normalizedReceipt.suggestedCorrections.join(', ')}` 
        : undefined
    };

    // Reuse existing execute logic
    return this.execute(dto);
  }
}
