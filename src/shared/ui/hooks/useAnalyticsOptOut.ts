import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setOptOutState } from '../../infrastructure/analytics/analyticsOptOutState';

const OPT_OUT_KEY = 'analytics_opt_out';

export interface UseAnalyticsOptOutResult {
  isOptedOut: boolean;
  setOptOut: (value: boolean) => Promise<void>;
}

/**
 * Hook for managing the user's analytics opt-out preference.
 *
 * Persists the preference in AsyncStorage under the key `analytics_opt_out`.
 * Initialises to `false` (opted in) until the stored value is read.
 */
export function useAnalyticsOptOut(): UseAnalyticsOptOutResult {
  const [isOptedOut, setIsOptedOut] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(OPT_OUT_KEY).then(value => {
      if (value !== null) {
        const opted = value === 'true';
        setIsOptedOut(opted);
        setOptOutState(opted);
      }
    });
  }, []);

  const setOptOut = useCallback(async (value: boolean): Promise<void> => {
    await AsyncStorage.setItem(OPT_OUT_KEY, value ? 'true' : 'false');
    setIsOptedOut(value);
    setOptOutState(value);
  }, []);

  return { isOptedOut, setOptOut };
}
