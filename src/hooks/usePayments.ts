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

    // Fallback: derive name from linked task's subcontractor when all other fields are empty
    if (contractorName === 'Invoice Payable' && inv.taskId && taskRepo && contactRepo) {
      try {
        const task = await taskRepo.findById(inv.taskId);
        if (task?.subcontractorId) {
          const contact = await contactRepo.findById(task.subcontractorId);
          if (contact?.name) contractorName = contact.name;
        }
      } catch { /* ignore — non-critical enrichment */ }
    }

    payableRows.push({
      id: `invoice-payable:${inv.id}`,
      invoiceId: inv.id,
      projectId: inv.projectId,
      amount: outstanding,
      currency: inv.currency,
      date: inv.dateIssued ?? inv.issueDate,
      dueDate: inv.dateDue ?? inv.dueDate,
      status: 'pending',
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

        const invoicePayablesRaw = await buildInvoicePayables(invoiceResult.items, paymentRepo, taskRepo, contactRepo);
        const invoicePayables = contractorSearch
          ? invoicePayablesRaw.filter((p) =>
              (p.contractorName ?? '').toLowerCase().includes(contractorSearch.toLowerCase()),
            )
          : invoicePayablesRaw;

        const mergedGlobalItems = [...result.items, ...invoicePayables];

        // Resolve project names for display
        const projectMap = new Map<string, string>();
        const projectIds = [...new Set(mergedGlobalItems.map(p => p.projectId).filter(Boolean))] as string[];
        await Promise.all(
          projectIds.map(async (id) => {
            try {
              const proj: Project | null = await projectRepo.findById(id);
              if (proj) projectMap.set(id, proj.name);
            } catch (_) { /* ignore missing projects */ }
          }),
        );

        const enriched: PaymentWithProject[] = mergedGlobalItems.map(p => ({
          ...p,
          projectName: p.projectId ? (projectMap.get(p.projectId) ?? p.projectId) : undefined,
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

        const invoicePayables = await buildInvoicePayables(invoiceResult.items, paymentRepo, taskRepo, contactRepo);
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
