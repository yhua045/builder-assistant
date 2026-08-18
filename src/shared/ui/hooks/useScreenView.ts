import { useEffect } from 'react';
import { useAnalytics } from './useAnalytics';

/**
 * useScreenView — automatically tracks a screen view on component mount.
 *
 * Fires exactly once per mount lifecycle (empty dependency array).
 * Does NOT re-fire on re-renders or prop changes.
 *
 * Usage:
 *   function DashboardScreen() {
 *     useScreenView('Dashboard');
 *     ...
 *   }
 */
export function useScreenView(
  screenName: string,
  properties?: Record<string, string | number | boolean>,
): void {
  const { screen } = useAnalytics();

  useEffect(() => {
    screen(screenName, properties);
    // Intentionally empty deps — one event per mount, not per render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
