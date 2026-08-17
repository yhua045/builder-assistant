import { useEffect, useMemo } from 'react';
import { container } from 'tsyringe';
import { AnalyticsAdapter } from '../shared/infrastructure/analytics/AnalyticsAdapter';
import '../shared/infrastructure/di/registerServices';

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
  const analytics = useMemo(() => {
    try {
      return container.resolve<AnalyticsAdapter>('AnalyticsAdapter');
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (analytics && typeof (analytics as AnalyticsAdapter & { screen?: (name: string) => void }).screen === 'function') {
      analytics.screen(screenName);
    }
  }, [analytics, screenName]);
}
