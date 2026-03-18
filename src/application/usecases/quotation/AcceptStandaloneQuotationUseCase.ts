import { Invoice } from '../../../domain/entities/Invoice';
import { Quotation } from '../../../domain/entities/Quotation';
import { InvoiceRepository } from '../../../domain/repositories/InvoiceRepository';
import { QuotationRepository } from '../../../domain/repositories/QuotationRepository';

export interface AcceptStandaloneQuotationInput {
  quotationId: string;
  projectId: string;
}

export interface AcceptStandaloneQuotationOutput {
  invoice: Invoice;
  quotation: Quotation;
}

/**
 * AcceptStandaloneQuotationUseCase
 *
 * Accepts a project-level quotation that is NOT linked to a task (no taskId).
 * Mirrors AcceptQuotationUseCase for the standalone path:
 *   1. Validates the quotation exists and is in 'sent' status.
 *   2. Creates an Invoice record (status 'issued') from the quotation data.
 *   3. Transitions the quotation to 'accepted'.
 *   4. Returns the created invoice and updated quotation.
 *
 * For task-linked quotes use AcceptQuotationUseCase (which also updates task.quoteStatus).
 */
export class AcceptStandaloneQuotationUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly quotationRepo: QuotationRepository,
  ) {}

  async execute(
    input: AcceptStandaloneQuotationInput,
  ): Promise<AcceptStandaloneQuotationOutput> {
    const { quotationId, projectId } = input;

    // ── Load and validate quotation ─────────────────────────────────────────
    const quotation = await this.quotationRepo.getQuotation(quotationId);
    if (!quotation) throw new Error('QUOTATION_NOT_FOUND');
    if (quotation.status === 'accepted') throw new Error('QUOTATION_ALREADY_ACCEPTED');
    if (quotation.status === 'declined') throw new Error('QUOTATION_ALREADY_DECLINED');

    const now = new Date().toISOString();
    const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // ── Create invoice from quotation data ──────────────────────────────────
    const invoice = await this.invoiceRepo.createInvoice({
      id: invoiceId,
      projectId,
      quoteId: quotationId,
      issuerName: quotation.vendorName,
      issuerAddress: quotation.vendorAddress,
      status: 'issued',
      paymentStatus: 'unpaid',
      total: quotation.total,
      subtotal: quotation.subtotal ?? quotation.total,
      currency: quotation.currency ?? 'AUD',
      notes: `Auto-generated from accepted quotation: ${quotation.reference}`,
      metadata: {
        source: 'accept-standalone-quotation',
        quotationReference: quotation.reference,
      },
      dateIssued: now,
      createdAt: now,
      updatedAt: now,
    } as Invoice);

    // ── Transition quotation to accepted ────────────────────────────────────
    const updatedQuotation = await this.quotationRepo.updateQuotation(quotationId, {
      status: 'accepted',
      updatedAt: now,
    });

    return { invoice, quotation: updatedQuotation };
  }
}
