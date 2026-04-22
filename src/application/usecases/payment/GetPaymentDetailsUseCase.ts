import { Payment } from '../../../domain/entities/Payment';
import { Invoice } from '../../../domain/entities/Invoice';
import { Project } from '../../../domain/entities/Project';
import { PaymentRepository } from '../../../domain/repositories/PaymentRepository';
import { InvoiceRepository } from '../../../domain/repositories/InvoiceRepository';
import { ProjectRepository } from '../../../domain/repositories/ProjectRepository';
import { getDueStatus } from '../../../utils/getDueStatus';
import type { DueStatus } from '../../../utils/getDueStatus';

// ── Input discriminated union ─────────────────────────────────────────────────

export type GetPaymentDetailsInput =
  | { paymentId: string; invoiceId?: never; syntheticRow?: never }
  | { invoiceId: string; paymentId?: never; syntheticRow?: never }
  | { syntheticRow: Payment; paymentId?: never; invoiceId?: never };

// ── Output DTO ────────────────────────────────────────────────────────────────

export interface PaymentDetailsDTO {
  /** The resolved payment (real or synthetic). Null when not found. */
  payment: Payment | null;
  /** The linked invoice, if any. */
  invoice: Invoice | null;
  /** Other settled/pending payments sharing the same invoiceId (excludes the resolved payment). */
  linkedPayments: Payment[];
  /** The linked project, if any. */
  project: Project | null;
  /** True when payment was synthesised from an invoice (no real payment row). */
  isSyntheticRow: boolean;
  /** Routing discriminator for project-assignment operations. */
  recordContext: 'synthetic-invoice' | 'standalone-payment';
  /** The ID to target when assigning a project: invoiceId for synthetic, paymentId for standalone. */
  targetIdForUpdates: string;
  // ── Derived business fields (computed by use case) ──────────────────────────
  /** The effective project ID: invoice.projectId for synthetic rows, payment.projectId otherwise. */
  resolvedProjectId: string | undefined;
  /** Due-date status relative to today, or null if no due date. */
  dueStatus: DueStatus | null;
  /** Sum of all linked payments with status 'settled'. */
  totalSettled: number;
  /** invoice.total - totalSettled, or 0 when no invoice is linked. */
  remainingBalance: number;
  /** True when an unpaid/partial invoice exists and the remaining balance is > 0. */
  canRecordPayment: boolean;
  /** True when the payment status is 'pending' or absent. */
  isPending: boolean;
}

// ── Use case ──────────────────────────────────────────────────────────────────

export class GetPaymentDetailsUseCase {
  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly invoiceRepo: InvoiceRepository,
    private readonly projectRepo: ProjectRepository,
  ) {}

  async execute(input: GetPaymentDetailsInput): Promise<PaymentDetailsDTO> {
    if (input.invoiceId) {
      return this.executeInvoiceEntry(input.invoiceId);
    }
    if (input.syntheticRow) {
      return this.executeSyntheticRow(input.syntheticRow);
    }
    // Exhaustive: union guarantees paymentId is a string here
    return this.executePaymentEntry(input.paymentId!);
  }

  // ── Branch A: Invoice-entry ─────────────────────────────────────────────

  private async executeInvoiceEntry(invoiceId: string): Promise<PaymentDetailsDTO> {
    const [invoice, payments] = await Promise.all([
      this.invoiceRepo.getInvoice(invoiceId),
      this.paymentRepo.findByInvoice(invoiceId),
    ]);

    if (!invoice) {
      return { payment: null, invoice: null, linkedPayments: [], project: null, isSyntheticRow: false, recordContext: 'standalone-payment', targetIdForUpdates: '', ...this.computeDerivedFields(null, null, [], false) };
    }

    const settled = payments
      .filter((p) => p.status === 'settled')
      .reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const outstanding = invoice.total - settled;

    const syntheticPayment: Payment = {
      id: `invoice-payable:${invoice.id}`,
      invoiceId: invoice.id,
      projectId: invoice.projectId,
      amount: outstanding,
      currency: invoice.currency,
      date: invoice.dateIssued ?? invoice.issueDate,
      dueDate: invoice.dateDue ?? invoice.dueDate ?? null,
      status: 'pending',
      contractorName: invoice.issuerName ?? invoice.vendor ?? 'Invoice Payable',
      notes: invoice.notes,
      reference: invoice.externalReference ?? invoice.externalId ?? invoice.id,
      stageLabel: invoice.externalReference ?? invoice.invoiceNumber,
    } as unknown as Payment;

    const project = invoice.projectId
      ? await this.fetchProjectSafely(invoice.projectId)
      : null;

    return {
      payment: syntheticPayment,
      invoice,
      linkedPayments: payments,
      project,
      isSyntheticRow: true,
      recordContext: 'synthetic-invoice',
      targetIdForUpdates: invoiceId,
      ...this.computeDerivedFields(syntheticPayment, invoice, payments, true),
    };
  }

  // ── Branch B: Payment-entry ─────────────────────────────────────────────

  private async executePaymentEntry(paymentId: string): Promise<PaymentDetailsDTO> {
    const payment = await this.paymentRepo.findById(paymentId);

    if (!payment) {
      return { payment: null, invoice: null, linkedPayments: [], project: null, isSyntheticRow: false, recordContext: 'standalone-payment', targetIdForUpdates: '', ...this.computeDerivedFields(null, null, [], false) };
    }

    let invoice: Invoice | null = null;
    let linkedPayments: Payment[] = [];
    let project: Project | null = null;

    if (payment.projectId) {
      project = await this.fetchProjectSafely(payment.projectId);
    }

    if (payment.invoiceId) {
      const [inv, payments] = await Promise.all([
        this.invoiceRepo.getInvoice(payment.invoiceId),
        this.paymentRepo.findByInvoice(payment.invoiceId),
      ]);
      invoice = inv;
      linkedPayments = payments.filter((p) => p.id !== payment.id);
    }

    return {
      payment,
      invoice,
      linkedPayments,
      project,
      isSyntheticRow: false,
      recordContext: 'standalone-payment',
      targetIdForUpdates: paymentId,
      ...this.computeDerivedFields(payment, invoice, linkedPayments, false),
    };
  }

  // ── Branch C: Synthetic-row ─────────────────────────────────────────────

  private async executeSyntheticRow(syntheticRow: Payment): Promise<PaymentDetailsDTO> {
    const isSyntheticRow = (syntheticRow.id ?? '').startsWith('invoice-payable:');

    if (!syntheticRow.invoiceId) {
      return {
        payment: syntheticRow,
        invoice: null,
        linkedPayments: [],
        project: null,
        isSyntheticRow,
        recordContext: isSyntheticRow ? 'synthetic-invoice' : 'standalone-payment',
        targetIdForUpdates: isSyntheticRow ? '' : syntheticRow.id,
        ...this.computeDerivedFields(syntheticRow, null, [], isSyntheticRow),
      };
    }

    const [invoice, payments] = await Promise.all([
      this.invoiceRepo.getInvoice(syntheticRow.invoiceId),
      this.paymentRepo.findByInvoice(syntheticRow.invoiceId),
    ]);

    const projectId = invoice?.projectId;
    const project = projectId ? await this.fetchProjectSafely(projectId) : null;

    return {
      payment: syntheticRow,
      invoice,
      linkedPayments: payments,
      project,
      isSyntheticRow,
      recordContext: isSyntheticRow ? 'synthetic-invoice' : 'standalone-payment',
      targetIdForUpdates: isSyntheticRow ? syntheticRow.invoiceId! : syntheticRow.id,
      ...this.computeDerivedFields(syntheticRow, invoice, payments, isSyntheticRow),
    };
  }

  // ── Helper ──────────────────────────────────────────────────────────────

  private computeDerivedFields(
    payment: Payment | null,
    invoice: Invoice | null,
    linkedPayments: Payment[],
    isSyntheticRow: boolean,
  ): {
    resolvedProjectId: string | undefined;
    dueStatus: DueStatus | null;
    totalSettled: number;
    remainingBalance: number;
    canRecordPayment: boolean;
    isPending: boolean;
  } {
    const resolvedProjectId = isSyntheticRow ? invoice?.projectId : payment?.projectId;
    const dueStatus = payment?.dueDate ? getDueStatus(payment.dueDate) : null;
    const totalSettled = linkedPayments
      .filter((p) => p.status === 'settled')
      .reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const remainingBalance = invoice ? invoice.total - totalSettled : 0;
    const canRecordPayment =
      invoice !== null &&
      invoice.status !== 'cancelled' &&
      (invoice.paymentStatus === 'unpaid' || invoice.paymentStatus === 'partial') &&
      remainingBalance > 0;
    const isPending = payment?.status === 'pending' || payment?.status == null;
    return { resolvedProjectId, dueStatus, totalSettled, remainingBalance, canRecordPayment, isPending };
  }

  private async fetchProjectSafely(projectId: string): Promise<Project | null> {
    try {
      return await this.projectRepo.findById(projectId);
    } catch {
      return null;
    }
  }
}
