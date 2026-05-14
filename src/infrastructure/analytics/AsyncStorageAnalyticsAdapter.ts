import AsyncStorage from '@react-native-async-storage/async-storage';
import { AnalyticsAdapter } from './AnalyticsAdapter';
import type { AnalyticsEvent } from '../../domain/analytics/AnalyticsEvent';

const STORAGE_KEY = '@analytics/events';
const MAX_EVENTS = 500;

/**
 * AsyncStorageAnalyticsAdapter — local, on-device analytics buffer.
 *
 * Extends AnalyticsAdapter (unified abstract base) so it can be composed
 * inside CompositeAnalyticsAdapter alongside Firebase and Mixpanel adapters.
 *
 * Persistence strategy:
 *   - `track()` / `screen()` are synchronous from the caller's perspective.
 *     Events are appended to an in-memory buffer immediately; an async write
 *     to AsyncStorage is dispatched without blocking.
 *   - `getEvents()` reads from AsyncStorage (source of truth after restarts).
 *   - `clearEvents()` / `reset()` clear both the in-memory buffer and the
 *     AsyncStorage key.
 *   - Buffer is capped at MAX_EVENTS (500). Oldest events are pruned.
 *   - All AsyncStorage errors are silently caught (graceful degradation).
 *
 * Privacy invariants:
 *   - `identify()` is a no-op — local storage, no user identity tracking.
 *   - Adapter stores ONLY what callers pass via `properties`. Callers are
 *     responsible for not passing PII.
 */
export class AsyncStorageAnalyticsAdapter extends AnalyticsAdapter {
  private _buffer: AnalyticsEvent[] = [];

  // ── AnalyticsAdapter interface ────────────────────────────────────────────

  identify(_userId: string, _traits?: Record<string, unknown>): void {
    // No-op: local-only adapter, no user identity tracking
  }

  track(event: string, properties?: Record<string, unknown>): void {
    const stamped: AnalyticsEvent = {
      name: event,
      timestampUtc: new Date().toISOString(),
      ...(properties !== undefined ? { properties: properties as Record<string, string | number | boolean> } : {}),
    };
    this._buffer.push(stamped);
    // Fire-and-forget persistence
    this._persist().catch(() => {/* silently ignored */});
  }

  screen(screenName: string, properties?: Record<string, unknown>): void {
    this.track('screen.viewed', { screen: screenName, ...properties });
  }

  reset(): void {
    this._buffer = [];
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {/* silently ignored */});
  }

  // ── Extra public methods (not on AnalyticsAdapter base) ──────────────────

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

  // ── Private helpers ───────────────────────────────────────────────────────

  private async _persist(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const persisted: AnalyticsEvent[] = raw ? (JSON.parse(raw) as AnalyticsEvent[]) : [];

      // Merge buffer into persisted, deduplicating by (name, timestampUtc)
      const merged = [...persisted];
      for (const evt of this._buffer) {
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
