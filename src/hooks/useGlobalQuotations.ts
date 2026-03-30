import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Quotation } from '../domain/entities/Quotation';
import { DrizzleQuotationRepository } from '../infrastructure/repositories/DrizzleQuotationRepository';
import { ListQuotationsUseCase } from '../application/usecases/quotation/ListQuotationsUseCase';
import { queryKeys } from './queryKeys';

export interface UseGlobalQuotationsOptions {
  vendorSearch?: string;
}

export interface UseGlobalQuotationsReturn {
  quotations: Quotation[];
  loading: boolean;
  refresh: () => void;
}

export function useGlobalQuotations(
  options?: UseGlobalQuotationsOptions,
): UseGlobalQuotationsReturn {
  const { vendorSearch } = options ?? {};
  const queryClient = useQueryClient();

  const repository = useMemo(() => new DrizzleQuotationRepository(), []);
  const listUc = useMemo(() => new ListQuotationsUseCase(repository), [repository]);

  const { data, isFetching } = useQuery({
    queryKey: queryKeys.globalQuotations(),
    queryFn: async () => {
      const result = await listUc.execute({ limit: 500 });
      return result.items;
    },
    staleTime: Infinity,
  });

  const quotations = useMemo((): Quotation[] => {
    const items = data ?? [];

    // Filter by vendor name (in-memory) — QuotationFilterParams has no vendorSearch param
    const filtered = vendorSearch
      ? items.filter((q) =>
          (q.vendorName ?? '').toLowerCase().includes(vendorSearch.toLowerCase()),
        )
      : items;

    // Sort by date descending (newest first)
    return [...filtered].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [data, vendorSearch]);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.globalQuotations() });

  return {
    quotations,
    loading: isFetching,
    refresh,
  };
}
