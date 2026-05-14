import { useCallback, useMemo } from 'react';
import { container } from 'tsyringe';
import '../infrastructure/di/registerServices';
import type { IAnalyticsService } from '../application/services/IAnalyticsService';
import { NullAnalyticsService } from '../infrastructure/analytics/NullAnalyticsService';

/**
 * useAnalytics — global singleton hook for UX event tracking.
 *
 * Resolves IAnalyticsService from the tsyringe DI container
 * (token: 'AnalyticsService'). Falls back to NullAnalyticsService
 * when the token is not registered (e.g., in isolated tests).
 *
 * AC-3: track/trackScreen calls are fire-and-forget and never throw.
 * AC-5: The hook is the stable abstraction; swapping the adapter requires
 *        zero changes here or in any UI code.
 */
export function useAnalytics(): {
  track: IAnalyticsService['track'];
  trackScreen: IAnalyticsService['trackScreen'];
} {
  const service = useMemo<IAnalyticsService>(() => {
    try {
      return container.resolve<IAnalyticsService>('AnalyticsService');
    } catch {
      return new NullAnalyticsService();
    }
  }, []);

  const track = useCallback<IAnalyticsService['track']>(
    (event) => {
      try {
        service.track(event);
      } catch {/* silently ignored — analytics must never crash the app */}
    },
    [service],
  );

  const trackScreen = useCallback<IAnalyticsService['trackScreen']>(
    (screenName, properties) => {
      try {
        service.trackScreen(screenName, properties);
      } catch {/* silently ignored */}
    },
    [service],
  );

  return { track, trackScreen };
}
