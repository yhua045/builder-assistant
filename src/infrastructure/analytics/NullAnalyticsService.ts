import type { AnalyticsEvent } from '../../domain/analytics/AnalyticsEvent';
import type { IAnalyticsService } from '../../application/services/IAnalyticsService';

/**
 * @deprecated Use `NoopAnalyticsAdapter` instead.
 * Superseded by `NoopAnalyticsAdapter` which extends `AnalyticsAdapter`
 * (Issue #223 × #219 reconciliation). No new code should import this class.
 * Kept here for transition only.
 *
 * NullAnalyticsService — in-memory stub for tests and safe defaults.
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
