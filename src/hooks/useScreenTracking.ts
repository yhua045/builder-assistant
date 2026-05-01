import { useEffect, useMemo } from 'react';
import { container } from 'tsyringe';
import { AnalyticsAdapter } from '../infrastructure/analytics/AnalyticsAdapter';
import '../infrastructure/di/registerServices';

/**
 * Fires a screen-view event via the AnalyticsAdapter on mount.
 *
 * Usage:
 *   function DashboardScreen() {
 *     useScreenTracking('Dashboard');
 *     ...
 *   }
 */
export function useScreenTracking(screenName: string): void {
  const analytics = useMemo(
    () => container.resolve<AnalyticsAdapter>('AnalyticsAdapter'),
    [],
  );

  useEffect(() => {
    analytics.screen(screenName);
  }, [analytics, screenName]);
}
