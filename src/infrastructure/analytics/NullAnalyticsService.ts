import type { AnalyticsEvent } from '../../domain/analytics/AnalyticsEvent';
import type { IAnalyticsService } from '../../application/services/IAnalyticsService';

/**
 * NullAnalyticsService — in-memory stub for tests and safe defaults.
 *
 * Does not persist to AsyncStorage. Collects events in a plain array so
 * tests can assert what was tracked.
 *
 * AC-5: Wired in test suites instead of the production adapter.
 */
export class NullAnalyticsService implements IAnalyticsService {
  private _events: AnalyticsEvent[] = [];

  track(event: Omit<AnalyticsEvent, 'timestampUtc'>): void {
    this._events.push({ ...event, timestampUtc: new Date().toISOString() });
  }

  trackScreen(
    screenName: string,
    properties?: Record<string, string | number | boolean>,
  ): void {
    this.track({
      name: 'screen.viewed',
      properties: { screen: screenName, ...properties },
    });
  }

  async getEvents(): Promise<AnalyticsEvent[]> {
    return [...this._events];
  }

  async clearEvents(): Promise<void> {
    this._events = [];
  }
}
