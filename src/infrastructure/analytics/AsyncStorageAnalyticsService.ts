import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AnalyticsEvent } from '../../domain/analytics/AnalyticsEvent';
import type { IAnalyticsService } from '../../application/services/IAnalyticsService';

const STORAGE_KEY = '@analytics/events';
const MAX_EVENTS = 500;

/**
 * AsyncStorageAnalyticsService — production analytics adapter.
 *
 * Persistence strategy:
 *   - `track()` is synchronous from the caller's perspective (AC-3).
 *     Events are appended to an in-memory buffer immediately, then
 *     an async write to AsyncStorage is dispatched without blocking.
 *   - `getEvents()` reads from AsyncStorage (source of truth after restarts).
 *   - `clearEvents()` clears both in-memory buffer and AsyncStorage key.
 *   - Buffer is capped at MAX_EVENTS (500). Oldest events are pruned.
 *   - All errors are silently caught (AC — graceful degradation).
 *
 * AC-4: This service stores ONLY what callers pass via `event.properties`.
 *        Callers are responsible for not passing PII.
 */
export class AsyncStorageAnalyticsService implements IAnalyticsService {
  private _buffer: AnalyticsEvent[] = [];

  track(event: Omit<AnalyticsEvent, 'timestampUtc'>): void {
    const stamped: AnalyticsEvent = {
      ...event,
      timestampUtc: new Date().toISOString(),
    };
    this._buffer.push(stamped);
    // Fire-and-forget persistence
    this._persist().catch(() => {/* silently ignored */});
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
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as AnalyticsEvent[];
    } catch {
      return [];
    }
  }

  async clearEvents(): Promise<void> {
    this._buffer = [];
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {/* silently ignored */}
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async _persist(): Promise<void> {
    try {
      // Read current persisted events, merge with buffer, prune to MAX_EVENTS
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const persisted: AnalyticsEvent[] = raw ? (JSON.parse(raw) as AnalyticsEvent[]) : [];

      // Merge: persisted + any newly buffered events not yet flushed
      // Use the in-memory buffer as the ground truth for the latest batch
      const merged = [...persisted];
      for (const evt of this._buffer) {
        // Avoid duplicates if _persist is called multiple times for the same batch
        if (!merged.some(e => e.timestampUtc === evt.timestampUtc && e.name === evt.name)) {
          merged.push(evt);
        }
      }

      // Prune oldest events if over limit
      const pruned = merged.length > MAX_EVENTS
        ? merged.slice(merged.length - MAX_EVENTS)
        : merged;

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    } catch {/* silently ignored */}
  }
}
