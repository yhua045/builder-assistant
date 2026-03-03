import { useState, useEffect, useCallback, useMemo } from 'react';
import { DelayReasonType } from '../domain/entities/DelayReason';
import { DelayReasonTypeRepository } from '../domain/repositories/DelayReasonTypeRepository';
import { container } from 'tsyringe';
import '../infrastructure/di/registerServices';

export interface UseDelayReasonTypesReturn {
  delayReasonTypes: DelayReasonType[];
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useDelayReasonTypes(): UseDelayReasonTypesReturn {
  const [delayReasonTypes, setDelayReasonTypes] = useState<DelayReasonType[]>([]);
  const [loading, setLoading] = useState(true);

  const repository = useMemo(
    () => container.resolve<DelayReasonTypeRepository>('DelayReasonTypeRepository'),
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const types = await repository.findAll();
      setDelayReasonTypes(types);
    } catch (error) {
      console.error('Failed to load delay reason types', error);
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    load();
  }, [load]);

  return useMemo(
    () => ({
      delayReasonTypes,
      loading,
      refresh: load,
    }),
    [delayReasonTypes, loading, load],
  );
}
