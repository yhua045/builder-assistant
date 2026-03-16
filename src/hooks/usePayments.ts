import { useEffect, useState, useCallback, useMemo } from 'react';
import { container } from 'tsyringe';
import { PaymentRepository } from '../domain/repositories/PaymentRepository';
import { ProjectRepository } from '../domain/repositories/ProjectRepository';
import { TaskRepository } from '../domain/repositories/TaskRepository';
import { ContactRepository } from '../domain/repositories/ContactRepository';
import { Payment } from '../domain/entities/Payment';
import { Invoice } from '../domain/entities/Invoice';
import { Project } from '../domain/entities/Project';
import { PaymentMetrics } from '../domain/repositories/PaymentRepository';
import { InvoiceRepository } from '../domain/repositories/InvoiceRepository';
import { ListGlobalPaymentsUseCase } from '../application/usecases/payment/ListGlobalPaymentsUseCase';
import { GetGlobalAmountPayableUseCase } from '../application/usecases/payment/GetGlobalAmountPayableUseCase';
import { ListPaymentsUseCase } from '../application/usecases/payment/ListPaymentsUseCase';
import { GetPaymentMetricsUseCase } from '../application/usecases/payment/GetPaymentMetricsUseCase';
import { resolveInvoiceDueDate } from '../utils/resolveInvoiceDueDate';
import '../infrastructure/di/registerServices';

export type PaymentsMode = 'firefighter' | 'site_manager';

export type PaymentWithProject = Payment & { projectName?: string };

function deriveCategoryFromInvoice(invoice: Invoice): Payment['paymentCategory'] {
  const metadataCategory = invoice.metadata?.paymentCategory;
  if (metadataCategory === 'contract' || metadataCategory === 'variation' || metadataCategory === 'other') {
    return metadataCategory;
  }
  const note = (invoice.notes ?? '').toLowerCase();
  if (note.includes('variation')) return 'variation';
  if (note.includes('contract')) return 'contract';
  return 'other';
}

function deriveContractorNameFromInvoice(invoice: Invoice): string {
  const metadataName = invoice.metadata?.contractorName;
  if (typeof metadataName === 'string' && metadataName.trim()) return metadataName.trim();

  const issuer = invoice.issuerName?.trim();
  if (issuer) return issuer;

  const recipient = invoice.recipientName?.trim();
  if (recipient) return recipient;

  const ref = invoice.externalReference ?? invoice.invoiceNumber ?? invoice.externalId;
  if (ref) return `Invoice ${ref}`;

  return 'Invoice Payable';
}

function getSettledPaidAmount(payments: Payment[]): number {
  return payments.reduce((sum, p) => {
    if (p.status === 'settled') return sum + (p.amount ?? 0);
    return sum;
  }, 0);
}

async function buildInvoicePayables(
  invoices: Invoice[],
  paymentRepo: PaymentRepository,
  taskRepo?: TaskRepository | null,
  contactRepo?: ContactRepository | null,
  projectMap?: Map<string, Project>,
): Promise<Payment[]> {
  const payableRows: Payment[] = [];

  for (const inv of invoices) {
    if (inv.status === 'cancelled' || inv.status === 'draft') continue;
    if (inv.paymentStatus === 'paid') continue;

    const linkedPayments = await paymentRepo.findByInvoice(inv.id);

    // Avoid duplicating obligations when a pending synthetic payment already exists.
    const hasPendingLegacyPayable = linkedPayments.some((p) => p.status === 'pending');
    if (hasPendingLegacyPayable) continue;

    const paidAmount = getSettledPaidAmount(linkedPayments);
    const outstanding = Math.max((inv.total ?? 0) - paidAmount, 0);
    if (outstanding <= 0) continue;

    let contractorName = deriveContractorNameFromInvoice(inv);
    let taskStartDate: string | null = null;

    // Fetch linked task once — used for contractor name fallback AND due date anchor
    if (inv.taskId && taskRepo) {
      try {
        const task = await taskRepo.findById(inv.taskId);
        if (task) {
          // Use scheduled start as the due-date anchor
          taskStartDate = task.scheduledAt ?? task.scheduledStart ?? null;
          // Contractor name fallback via subcontractor contact
          if (contractorName === 'Invoice Payable' && contactRepo && task.subcontractorId) {
            const contact = await contactRepo.findById(task.subcontractorId);
            if (contact?.name) contractorName = contact.name;
          }
        }
      } catch { /* ignore — non-critical enrichment */ }
    }

    const project = inv.projectId ? projectMap?.get(inv.projectId) : undefined;
    const dueDatePeriodDays = project?.defaultDueDateDays ?? 5;
    const dueDate = resolveInvoiceDueDate(inv, taskStartDate, dueDatePeriodDays);

    payableRows.push({
      id: `invoice-payable:${inv.id}`,
      invoiceId: inv.id,
      projectId: inv.projectId,
      amount: outstanding,
      currency: inv.currency,
      date: inv.dateIssued ?? inv.issueDate,
      dueDate,
      status: 'pending',
      invoiceStatus: inv.status,
      contractorName,
      paymentCategory: deriveCategoryFromInvoice(inv),
      stageLabel: inv.externalReference ?? inv.invoiceNumber,
      notes: inv.notes,
      reference: inv.externalReference ?? inv.externalId ?? inv.id,
    });
  }

  return payableRows;
}

export interface UsePaymentsOptions {
  mode: PaymentsMode;
  /** Required in site_manager mode to scope payments to a project */
  projectId?: string;
  /** Active in firefighter mode — case-insensitive partial match on contractorName */
  contractorSearch?: string;
  paymentRepoOverride?: PaymentRepository;
  projectRepoOverride?: ProjectRepository;
  invoiceRepoOverride?: InvoiceRepository;
}

export interface UsePaymentsReturn {
  // Firefighter mode
  globalPayments: PaymentWithProject[];
  globalAmountPayable: number;
  // Site Manager mode
  contractPayments: Payment[];
  variationPayments: Payment[];
  contractTotal: number;
  variationTotal: number;
  // Common
  metrics: PaymentMetrics;
  loading: boolean;
  refresh: () => void;
}

export function usePayments(options: UsePaymentsOptions): UsePaymentsReturn {
  const {
    mode,
    projectId,
    contractorSearch,
    paymentRepoOverride,
    projectRepoOverride,
    invoiceRepoOverride,
  } = options;

  const paymentRepo = useMemo(
    () => paymentRepoOverride ?? container.resolve<PaymentRepository>('PaymentRepository' as any),
    [paymentRepoOverride],
  );
  const projectRepo = useMemo(
    () => projectRepoOverride ?? container.resolve<ProjectRepository>('ProjectRepository' as any),
    [projectRepoOverride],
  );
  const invoiceRepo = useMemo(
    () => invoiceRepoOverride ?? container.resolve<InvoiceRepository>('InvoiceRepository' as any),
    [invoiceRepoOverride],
  );

  const taskRepo = useMemo(() => {
    try { return container.resolve<TaskRepository>('TaskRepository' as any); } catch { return null; }
  }, []);
  const contactRepo = useMemo(() => {
    try { return container.resolve<ContactRepository>('ContactRepository' as any); } catch { return null; }
  }, []);

  const listGlobalUc = useMemo(() => new ListGlobalPaymentsUseCase(paymentRepo), [paymentRepo]);
  const globalAmountUc = useMemo(() => new GetGlobalAmountPayableUseCase(paymentRepo), [paymentRepo]);
  const listUc = useMemo(() => new ListPaymentsUseCase(paymentRepo), [paymentRepo]);
  const metricsUc = useMemo(() => new GetPaymentMetricsUseCase(paymentRepo), [paymentRepo]);

  const [globalPayments, setGlobalPayments] = useState<PaymentWithProject[]>([]);
  const [globalAmountPayable, setGlobalAmountPayable] = useState(0);
  const [contractPayments, setContractPayments] = useState<Payment[]>([]);
  const [variationPayments, setVariationPayments] = useState<Payment[]>([]);
  const [metrics, setMetrics] = useState<PaymentMetrics>({ pendingTotalNext7Days: 0, overdueCount: 0 });
  const [loading, setLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      if (mode === 'firefighter') {
        const [result, met, invoiceResult] = await Promise.all([
          listGlobalUc.execute({ contractorSearch }),
          metricsUc.execute(undefined),
          invoiceRepo.listInvoices({ limit: 500 }),
        ]);

        // Build project map from invoice project IDs so buildInvoicePayables can resolve
        // per-project defaultDueDateDays for due date computation.
        const invoiceProjectIds = [
          ...new Set(invoiceResult.items.map((inv) => inv.projectId).filter(Boolean)),
        ] as string[];
        const projectMap = new Map<string, Project>();
        await Promise.all(
          invoiceProjectIds.map(async (id) => {
            try {
              const proj = await projectRepo.findById(id);
              if (proj) projectMap.set(id, proj);
            } catch (_) { /* ignore missing projects */ }
          }),
        );

        const invoicePayablesRaw = await buildInvoicePayables(invoiceResult.items, paymentRepo, taskRepo, contactRepo, projectMap);
        const invoicePayables = contractorSearch
          ? invoicePayablesRaw.filter((p) =>
              (p.contractorName ?? '').toLowerCase().includes(contractorSearch.toLowerCase()),
            )
          : invoicePayablesRaw;

        const mergedGlobalItems = [...result.items, ...invoicePayables];

        // Ensure payment-only project IDs are also resolved (for display names)
        const additionalProjectIds = [
          ...new Set(result.items.map((p) => p.projectId).filter(Boolean)),
        ] as string[];
        await Promise.all(
          additionalProjectIds
            .filter((id) => !projectMap.has(id))
            .map(async (id) => {
              try {
                const proj = await projectRepo.findById(id);
                if (proj) projectMap.set(id, proj);
              } catch (_) { /* ignore missing projects */ }
            }),
        );

        const enriched: PaymentWithProject[] = mergedGlobalItems.map(p => ({
          ...p,
          projectName: p.projectId ? (projectMap.get(p.projectId)?.name ?? p.projectId) : undefined,
        }));

        setGlobalPayments(enriched);
        setGlobalAmountPayable(enriched.reduce((sum, p) => sum + (p.amount ?? 0), 0));
        setMetrics(met);
      } else {
        // site_manager mode — scoped to a project
        const [contracts, variations, met, invoiceResult] = await Promise.all([
          paymentRepo.list({ projectId, status: 'pending', paymentCategory: 'contract' }),
          paymentRepo.list({ projectId, status: 'pending', paymentCategory: 'variation' }),
          metricsUc.execute(projectId),
          invoiceRepo.listInvoices({ projectId, limit: 500 }),
        ]);

        // Load the current project for defaultDueDateDays resolution
        const projectMap = new Map<string, Project>();
        if (projectId) {
          try {
            const proj = await projectRepo.findById(projectId);
            if (proj) projectMap.set(projectId, proj);
          } catch (_) { /* ignore */ }
        }

        const invoicePayables = await buildInvoicePayables(invoiceResult.items, paymentRepo, taskRepo, contactRepo, projectMap);
        const invoiceContracts = invoicePayables.filter((p) => p.paymentCategory === 'contract');
        const invoiceVariations = invoicePayables.filter((p) => p.paymentCategory === 'variation');

        setContractPayments([...contracts.items, ...invoiceContracts]);
        setVariationPayments([...variations.items, ...invoiceVariations]);
        setMetrics(met);
      }
    } finally {
      setLoading(false);
    }
  }, [
    mode,
    projectId,
    contractorSearch,
    listGlobalUc,
    globalAmountUc,
    listUc,
    metricsUc,
    paymentRepo,
    projectRepo,
    invoiceRepo,
    taskRepo,
    contactRepo,
  ]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const contractTotal = useMemo(
    () => contractPayments.reduce((sum, p) => sum + (p.amount ?? 0), 0),
    [contractPayments],
  );
  const variationTotal = useMemo(
    () => variationPayments.reduce((sum, p) => sum + (p.amount ?? 0), 0),
    [variationPayments],
  );

  return {
    globalPayments,
    globalAmountPayable,
    contractPayments,
    variationPayments,
    contractTotal,
    variationTotal,
    metrics,
    loading,
    refresh: loadAll,
  };
}
