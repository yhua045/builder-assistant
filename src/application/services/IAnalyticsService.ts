import type { AnalyticsEvent } from '../../domain/analytics/AnalyticsEvent';

/**
 * Application-layer port (interface) for UX analytics.
 *
 * AC-3: `track` and `trackScreen` are fire-and-forget — callers MUST NOT await them.
 * AC-5: The interface is pluggable; production uses AsyncStorageAnalyticsService,
 *        tests use NullAnalyticsService, future upgrade uses PostHogAnalyticsService.
 */
export interface IAnalyticsService {
  /**
   * Track a discrete user interaction or feature usage event.
   * Synchronous from the caller's perspective; persistence is async and silent.
   */
  track(event: Omit<AnalyticsEvent, 'timestampUtc'>): void;

  /**
   * Convenience: track a screen view. Emits a "screen.viewed" event.
   */
  trackScreen(
    screenName: string,
    properties?: Record<string, string | number | boolean>,
  ): void;

  /**
   * Return a snapshot of locally buffered events (for debugging / export).
   */
  getEvents(): Promise<AnalyticsEvent[]>;

  /**
   * Clear the local event buffer.
   */
  clearEvents(): Promise<void>;
}
