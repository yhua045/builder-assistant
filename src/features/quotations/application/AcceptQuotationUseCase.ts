import { Contact } from '../../../domain/entities/Contact';
import { Invoice } from '../../../domain/entities/Invoice';
import { Quotation } from '../../../domain/entities/Quotation';
import { Task } from '../../../domain/entities/Task';
import { InvoiceRepository } from '../../../domain/repositories/InvoiceRepository';
import { QuotationRepository } from '../../../domain/repositories/QuotationRepository';
import { TaskRepository } from '../../../domain/repositories/TaskRepository';
import {
  resolveVendorDetails,
  VendorResolutionContext,
} from '../../../domain/services/VendorDetailsResolver';

export interface AcceptQuotationInput {
  /** ID of an existing quotation record to accept. Optional — omit for variation tasks with no prior quotation. */
  quotationId?: string;
  /** ID of the task this acceptance is for. Used to link invoice back to the task. */
  taskId: string;
  /** Minimal task data needed to create the invoice. */
  task: {
    title: string;
    projectId?: string;
    quoteAmount: number;
    taskType?: Task['taskType'];
    workType?: string;
    subcontractorId?: string;
  };
  /**
   * Pre-fetched Contact record for the subcontractor.
   * Pass the contact when it was resolved via ContactRepository.findById();
   * pass null/undefined when the contact could not be resolved.
   */
  contact?: Contact | null;
}

export interface AcceptQuotationOutput {
  /** The invoice created (or updated) for this acceptance. */
  invoice: Invoice;
  /** The accepted quotation record — populated only when quotationId was provided. */
  quotation?: Quotation;
}

/**
 * AcceptQuotationUseCase
 *
 * Encapsulates the complete "accept a quotation / variation" workflow:
 * 1. Resolves vendor details via VendorDetailsResolver (contact → quotation doc → unknown)
 * 2. Creates an invoice with fully-populated issuer fields (frozen at acceptance time)
 * 3. If a quotationId is provided: transitions quotation.status → 'accepted' and
 *    writes back the resolved vendor fields to the quotation record
 * 4. Updates task.quoteInvoiceId to link the newly created invoice
 */
export class AcceptQuotationUseCase {
  constructor(
    private readonly invoiceRepo: InvoiceRepository,
    private readonly taskRepo: TaskRepository,
    private readonly quotationRepo?: QuotationRepository,
  ) {}

  async execute(input: AcceptQuotationInput): Promise<AcceptQuotationOutput> {
    const { quotationId, taskId, task, contact } = input;

    // ── Load quotation (if provided) ────────────────────────────────────────
    let quotation: Quotation | undefined;
    if (quotationId && this.quotationRepo) {
      const found = await this.quotationRepo.getQuotation(quotationId);
      if (!found) throw new Error(`Quotation not found: ${quotationId}`);
      quotation = found;
    }

    // ── Resolve vendor details ───────────────────────────────────────────────
    const ctx: VendorResolutionContext = {
      subcontractorId: task.subcontractorId,
      contact: contact ?? null,
      quotation: quotation
        ? {
            vendorId: quotation.vendorId,
            contactId: quotation.contactId,
            vendorName: quotation.vendorName,
            vendorAddress: quotation.vendorAddress,
            vendorEmail: quotation.vendorEmail,
          }
        : null,
    };
    const vendor = resolveVendorDetails(ctx);

    // ── Create invoice ────────────────────────────────────────────────────────
    const now = new Date().toISOString();
    const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const invoice = await this.invoiceRepo.createInvoice({
      id: invoiceId,
      projectId: task.projectId,
      taskId,
      quoteId: quotationId,
      issuerName: vendor.vendorName !== 'Unknown Vendor' ? vendor.vendorName : undefined,
      issuerAddress: vendor.vendorAddress,
      status: 'issued',
      paymentStatus: 'unpaid',
      total: task.quoteAmount,
      subtotal: task.quoteAmount,
      currency: 'AUD',
      notes: `Auto-generated from ${task.taskType === 'variation' ? 'variation' : 'contract work'} task: ${task.title}`,
      metadata: {
        paymentCategory: task.taskType === 'variation' ? 'variation' : 'contract',
        source: 'accept-quotation-use-case',
        subcontractorId: task.subcontractorId,
        contractorName: vendor.vendorName !== 'Unknown Vendor' ? vendor.vendorName : undefined,
        vendorSource: vendor.source,
      },
      dateIssued: now,
      createdAt: now,
      updatedAt: now,
    } as Invoice);

    // ── Accept quotation and write back resolved vendor details ──────────────
    // Values are frozen at acceptance time (audit trail — see design Q2)
    let acceptedQuotation: Quotation | undefined;
    if (quotation && this.quotationRepo) {
      acceptedQuotation = await this.quotationRepo.updateQuotation(quotation.id, {
        status: 'accepted',
        vendorId: vendor.vendorId ?? quotation.vendorId,
        vendorName: vendor.vendorName !== 'Unknown Vendor' ? vendor.vendorName : quotation.vendorName,
        vendorAddress: vendor.vendorAddress ?? quotation.vendorAddress,
        vendorEmail: vendor.vendorEmail ?? quotation.vendorEmail,
        taskId,
      });
    }

    // ── Link invoice back to task ────────────────────────────────────────────
    const currentTask = await this.taskRepo.findById(taskId);
    if (currentTask) {
      await this.taskRepo.update({
        ...currentTask,
        quoteInvoiceId: invoice.id,
        quoteStatus: 'accepted',
        updatedAt: now,
      });
    }

    return { invoice, quotation: acceptedQuotation };
  }
}
