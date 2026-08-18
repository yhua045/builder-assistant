import { useCallback, useMemo } from 'react';
import { container } from 'tsyringe';
import '../../infrastructure/di/registerServices';
import type { AnalyticsAdapter } from '../../infrastructure/analytics/AnalyticsAdapter';
import { NoopAnalyticsAdapter } from '../../infrastructure/analytics/NoopAnalyticsAdapter';

/**
 * useAnalytics — global singleton hook for UX event tracking.
 *
 * Resolves AnalyticsAdapter from the tsyringe DI container
 * (token: 'AnalyticsAdapter'). Falls back to NoopAnalyticsAdapter
 * when the token is not registered (e.g., in isolated tests).
 *
 * AC-3: track/screen calls are fire-and-forget and never throw.
 * AC-4: Single DI token 'AnalyticsAdapter' consumed by hooks.
 * AC-5: The hook is the stable abstraction; swapping the adapter requires
 *        zero changes here or in any UI code.
 */
export function useAnalytics(): {
  track: (event: string, properties?: Record<string, unknown>) => void;
  screen: (screenName: string, properties?: Record<string, unknown>) => void;
} {
  const adapter = useMemo<AnalyticsAdapter>(() => {
    try {
      return container.resolve<AnalyticsAdapter>('AnalyticsAdapter');
    } catch {
      return new NoopAnalyticsAdapter();
    }
  }, []);

  const track = useCallback(
    (event: string, properties?: Record<string, unknown>) => {
      try {
        adapter.track(event, properties);
      } catch {/* silently ignored — analytics must never crash the app */}
    },
    [adapter],
  );

  const screen = useCallback(
    (screenName: string, properties?: Record<string, unknown>) => {
      try {
        adapter.screen(screenName, properties);
      } catch {/* silently ignored */}
    },
    [adapter],
  );

  return { track, screen };
}
