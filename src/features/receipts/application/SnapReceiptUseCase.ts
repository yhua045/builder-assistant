import { Invoice, InvoiceEntity } from '../../../domain/entities/Invoice';
import { Payment, PaymentEntity } from '../../../domain/entities/Payment';
import { ReceiptRepository } from '../domain/ReceiptRepository';
import { IOcrAdapter } from '../../../application/services/IOcrAdapter';
import { ReceiptFieldParser } from './ReceiptFieldParser';
import { IReceiptNormalizer, NormalizedReceipt } from './IReceiptNormalizer';

export interface ReceiptLineItemDTO {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SnapReceiptDTO {
  vendorId: string;
  vendor: string;
  amount: number;
  date: string;
  paymentMethod: Payment['method'];
  projectId?: string;
  category?: string;
  currency?: string;
  notes?: string;
  lineItems?: ReceiptLineItemDTO[];
}

export class SnapReceiptUseCase {
  constructor(
    private readonly receiptRepo: ReceiptRepository,
    private readonly ocrAdapter?: IOcrAdapter,
    private readonly fieldParser?: ReceiptFieldParser,
    private readonly normalizer?: IReceiptNormalizer
  ) {}

  async execute(input: SnapReceiptDTO): Promise<{ invoice: Invoice; payment: Payment }> {
    if (!input.vendorId || !input.vendorId.trim()) {
      throw new Error('Vendor is required');
    }
    if (input.amount <= 0) {
      throw new Error('Amount must be positive');
    }
    if (!input.vendor) {
        throw new Error('Vendor is required');
    }
    if (!input.date || isNaN(Date.parse(input.date))) {
      throw new Error('Date must be a valid ISO date');
    }

    const currency = input.currency || 'AUD';

    // 1. Create Invoice
    const lineItemDTOs = input.lineItems && input.lineItems.length > 0
      ? input.lineItems
      : undefined;

    // When line items are present, subtotal = sum of line item totals
    const lineItemSubtotal = lineItemDTOs
      ? lineItemDTOs.reduce((sum, item) => sum + item.total, 0)
      : undefined;

    const invoiceEntity = InvoiceEntity.create({
      issuerName: input.vendor,
      total: input.amount,
      subtotal: lineItemSubtotal,
      currency,
      status: 'paid', // Immediately paid
      paymentStatus: 'paid',
      dateIssued: input.date,
      paymentDate: input.date, // Paid on same day
      projectId: input.projectId,
      notes: input.notes,
      lineItems: lineItemDTOs
        ? lineItemDTOs.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          }))
        : undefined,
      metadata: {
        ...(input.category ? { category: input.category } : {}),
        vendorId: input.vendorId,
      },
    });

    const invoice = invoiceEntity.data();

    // 2. Create Payment
    const paymentEntity = PaymentEntity.create({
      amount: input.amount,
      date: input.date,
      projectId: input.projectId,
      invoiceId: invoice.id,
      method: input.paymentMethod,
      currency,
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
   * Save normalized receipt as invoice + payment.
   * This is the OCR flow — vendor comes from text recognition, not a contact
   * picker, so vendorId is not required here.
   */
  async saveReceipt(
    normalizedReceipt: NormalizedReceipt,
    paymentMethod: Payment['method'],
    projectId?: string
  ): Promise<{ invoice: Invoice; payment: Payment }> {
    const currency = normalizedReceipt.currency || 'AUD';
    const date = normalizedReceipt.date?.toISOString() || new Date().toISOString();
    const vendor = normalizedReceipt.vendor || 'Unknown Vendor';
    const amount = normalizedReceipt.total || 0;

    const invoiceEntity = InvoiceEntity.create({
      issuerName: vendor,
      total: amount,
      currency,
      status: 'paid',
      paymentStatus: 'paid',
      dateIssued: date,
      paymentDate: date,
      projectId,
      notes:
        normalizedReceipt.suggestedCorrections.length > 0
          ? `OCR Suggestions: ${normalizedReceipt.suggestedCorrections.join(', ')}`
          : undefined,
    });
    const invoice = invoiceEntity.data();

    const paymentEntity = PaymentEntity.create({
      amount,
      date,
      projectId,
      invoiceId: invoice.id,
      method: paymentMethod,
      currency,
      status: 'settled',
    });
    const payment = paymentEntity.data();

    return this.receiptRepo.createReceipt(invoice, payment);
  }
}
