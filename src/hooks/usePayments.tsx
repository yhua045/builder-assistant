import { useEffect, useState, useCallback, useMemo } from 'react';
import container from '../infrastructure/di/registerServices';
import { PaymentRepository } from '../domain/repositories/PaymentRepository';
import { ListPaymentsUseCase } from '../application/usecases/payment/ListPaymentsUseCase';
import { GetPaymentMetricsUseCase } from '../application/usecases/payment/GetPaymentMetricsUseCase';

export function usePayments(projectId?: string, repoOverride?: PaymentRepository) {
  const repo = repoOverride ?? container.resolve<PaymentRepository>('PaymentRepository' as any);
  const listUc = useMemo(() => new ListPaymentsUseCase(repo), [repo]);
  const metricsUc = useMemo(() => new GetPaymentMetricsUseCase(repo), [repo]);

  const [overdue, setOverdue] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [paid, setPaid] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>({ pendingTotalNext7Days: 0, overdueCount: 0 });
  const [loading, setLoading] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ov, up, pd, met] = await Promise.all([
        listUc.execute({ preset: 'overdue', projectId }),
        listUc.execute({ preset: 'upcoming', projectId }),
        listUc.execute({ preset: 'paid', projectId }),
        metricsUc.execute(projectId),
      ]);
      setOverdue(ov.items);
      setUpcoming(up.items);
      setPaid(pd.items);
      setMetrics(met);
    } finally {
      setLoading(false);
    }
  }, [listUc, metricsUc, projectId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  return { overdue, upcoming, paid, metrics, loading, refresh: loadAll };
}
