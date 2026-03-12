import { useEffect, useState, useCallback, useMemo } from 'react';
import { container } from 'tsyringe';
import { PaymentRepository } from '../domain/repositories/PaymentRepository';
import { ProjectRepository } from '../domain/repositories/ProjectRepository';
import { Payment } from '../domain/entities/Payment';
import { Project } from '../domain/entities/Project';
import { PaymentMetrics } from '../domain/repositories/PaymentRepository';
import { ListGlobalPaymentsUseCase } from '../application/usecases/payment/ListGlobalPaymentsUseCase';
import { GetGlobalAmountPayableUseCase } from '../application/usecases/payment/GetGlobalAmountPayableUseCase';
import { ListPaymentsUseCase } from '../application/usecases/payment/ListPaymentsUseCase';
import { GetPaymentMetricsUseCase } from '../application/usecases/payment/GetPaymentMetricsUseCase';
import '../infrastructure/di/registerServices';

export type PaymentsMode = 'firefighter' | 'site_manager';

export type PaymentWithProject = Payment & { projectName?: string };

export interface UsePaymentsOptions {
  mode: PaymentsMode;
  /** Required in site_manager mode to scope payments to a project */
  projectId?: string;
  /** Active in firefighter mode — case-insensitive partial match on contractorName */
  contractorSearch?: string;
  paymentRepoOverride?: PaymentRepository;
  projectRepoOverride?: ProjectRepository;
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
  const { mode, projectId, contractorSearch, paymentRepoOverride, projectRepoOverride } = options;

  const paymentRepo = useMemo(
    () => paymentRepoOverride ?? container.resolve<PaymentRepository>('PaymentRepository' as any),
    [paymentRepoOverride],
  );
  const projectRepo = useMemo(
    () => projectRepoOverride ?? container.resolve<ProjectRepository>('ProjectRepository' as any),
    [projectRepoOverride],
  );

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
        const [result, total, met] = await Promise.all([
          listGlobalUc.execute({ contractorSearch }),
          globalAmountUc.execute(contractorSearch),
          metricsUc.execute(undefined),
        ]);

        // Resolve project names for display
        const projectMap = new Map<string, string>();
        const projectIds = [...new Set(result.items.map(p => p.projectId).filter(Boolean))] as string[];
        await Promise.all(
          projectIds.map(async (id) => {
            try {
              const proj: Project | null = await projectRepo.findById(id);
              if (proj) projectMap.set(id, proj.name);
            } catch (_) { /* ignore missing projects */ }
          }),
        );

        const enriched: PaymentWithProject[] = result.items.map(p => ({
          ...p,
          projectName: p.projectId ? (projectMap.get(p.projectId) ?? p.projectId) : undefined,
        }));

        setGlobalPayments(enriched);
        setGlobalAmountPayable(total);
        setMetrics(met);
      } else {
        // site_manager mode — scoped to a project
        const [contracts, variations, met] = await Promise.all([
          paymentRepo.list({ projectId, status: 'pending', paymentCategory: 'contract' }),
          paymentRepo.list({ projectId, status: 'pending', paymentCategory: 'variation' }),
          metricsUc.execute(projectId),
        ]);
        setContractPayments(contracts.items);
        setVariationPayments(variations.items);
        setMetrics(met);
      }
    } finally {
      setLoading(false);
    }
  }, [mode, projectId, contractorSearch, listGlobalUc, globalAmountUc, listUc, metricsUc, paymentRepo, projectRepo]);

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
