/**
 * Unit tests for AsyncStorageAnalyticsAdapter.
 *
 * AC-1: Adapter extends AnalyticsAdapter (instanceof check).
 * AC-3: track() / screen() are fire-and-forget (synchronous from caller PoV).
 * AC-4: Adapter stores ONLY what callers pass — no auto-injected PII.
 * Buffer limit: max 500 events; oldest are pruned.
 * Graceful degradation: AsyncStorage errors do not propagate to callers.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AsyncStorageAnalyticsAdapter } from '../../../src/infrastructure/analytics/AsyncStorageAnalyticsAdapter';
import { AnalyticsAdapter } from '../../../src/infrastructure/analytics/AnalyticsAdapter';

const STORAGE_KEY = '@analytics/events';

async function flushPersist() {
  // Flush all pending promises so AsyncStorage writes settle
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('AsyncStorageAnalyticsAdapter', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  // ── Abstraction contract ─────────────────────────────────────────────────

  it('is an instance of AnalyticsAdapter', () => {
    const adapter = new AsyncStorageAnalyticsAdapter();
    expect(adapter).toBeInstanceOf(AnalyticsAdapter);
  });

  // ── track() ─────────────────────────────────────────────────────────────

  it('track(event) persists event as AnalyticsEvent.name', async () => {
    const adapter = new AsyncStorageAnalyticsAdapter();
    adapter.track('receipt.snap_started');
    await flushPersist();
    const events = await adapter.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('receipt.snap_started');
  });

  it('track() stamps timestampUtc as ISO 8601', async () => {
    const before = new Date().toISOString();
    const adapter = new AsyncStorageAnalyticsAdapter();
    adapter.track('test.stamp');
    await flushPersist();
    const after = new Date().toISOString();
    const events = await adapter.getEvents();
    expect(events[0].timestampUtc >= before).toBe(true);
    expect(events[0].timestampUtc <= after).toBe(true);
    expect(events[0].timestampUtc).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('track() stores caller-supplied properties exactly', async () => {
    const adapter = new AsyncStorageAnalyticsAdapter();
    adapter.track('task.created', { method: 'voice' });
    await flushPersist();
    const events = await adapter.getEvents();
    expect(events[0].properties).toEqual({ method: 'voice' });
  });

  it('track() with no properties stores undefined properties', async () => {
    const adapter = new AsyncStorageAnalyticsAdapter();
    adapter.track('dashboard.quick_actions_opened');
    await flushPersist();
    const events = await adapter.getEvents();
    expect(events[0].properties).toBeUndefined();
  });

  // ── screen() ─────────────────────────────────────────────────────────────

  it('screen(screenName) stores event as name "screen.viewed"', async () => {
    const adapter = new AsyncStorageAnalyticsAdapter();
    adapter.screen('Dashboard');
    await flushPersist();
    const events = await adapter.getEvents();
    expect(events[0].name).toBe('screen.viewed');
  });

  it('screen(screenName) stores screen name in properties.screen', async () => {
    const adapter = new AsyncStorageAnalyticsAdapter();
    adapter.screen('ProjectDetail');
    await flushPersist();
    const events = await adapter.getEvents();
    expect(events[0].properties?.screen).toBe('ProjectDetail');
  });

  it('screen() merges additional properties', async () => {
    const adapter = new AsyncStorageAnalyticsAdapter();
    adapter.screen('Tasks', { filter: 'active' });
    await flushPersist();
    const events = await adapter.getEvents();
    expect(events[0].properties).toEqual({ screen: 'Tasks', filter: 'active' });
  });

  // ── identify() ───────────────────────────────────────────────────────────

  it('identify() does not throw (no-op — local storage, no user identity)', () => {
    const adapter = new AsyncStorageAnalyticsAdapter();
    expect(() => adapter.identify('user-123')).not.toThrow();
  });

  it('identify() does not persist any event', async () => {
    const adapter = new AsyncStorageAnalyticsAdapter();
    adapter.identify('user-123');
    await flushPersist();
    const events = await adapter.getEvents();
    expect(events).toHaveLength(0);
  });

  // ── reset() ──────────────────────────────────────────────────────────────

  it('reset() clears the in-memory buffer', async () => {
    const adapter = new AsyncStorageAnalyticsAdapter();
    adapter.track('event.a');
    await flushPersist();
    await adapter.reset();
    const events = await adapter.getEvents();
    expect(events).toHaveLength(0);
  });

  it('reset() clears the AsyncStorage key', async () => {
    const adapter = new AsyncStorageAnalyticsAdapter();
    adapter.track('event.a');
    await flushPersist();
    await adapter.reset();
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    expect(raw).toBeNull();
  });

  // ── buffer cap ───────────────────────────────────────────────────────────

  it('buffer is capped at 500 events — oldest pruned after 501 track() calls', async () => {
    const adapter = new AsyncStorageAnalyticsAdapter();
    for (let i = 0; i < 501; i++) {
      adapter.track(`event.${i}`);
    }
    await flushPersist();
    const events = await adapter.getEvents();
    expect(events).toHaveLength(500);
    // Oldest event (event.0) should have been pruned
    expect(events[0].name).toBe('event.1');
  });

  // ── PII invariant ────────────────────────────────────────────────────────

  it('no auto-added PII properties — stored properties equal exactly what caller passed', async () => {
    const adapter = new AsyncStorageAnalyticsAdapter();
    adapter.track('task.created', { method: 'voice' });
    await flushPersist();
    const events = await adapter.getEvents();
    // Only the keys explicitly passed by the caller — no extras
    expect(Object.keys(events[0].properties ?? {})).toEqual(['method']);
  });

  // ── Graceful degradation ──────────────────────────────────────────────────

  it('track() does not throw when AsyncStorage.setItem fails', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('Storage full'));
    const adapter = new AsyncStorageAnalyticsAdapter();
    expect(() => adapter.track('event.graceful')).not.toThrow();
    await flushPersist();
  });

  it('getEvents() returns empty array when AsyncStorage.getItem throws', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('Read error'));
    const adapter = new AsyncStorageAnalyticsAdapter();
    const events = await adapter.getEvents();
    expect(events).toEqual([]);
  });

  // ── clearEvents() ────────────────────────────────────────────────────────

  it('clearEvents() empties AsyncStorage and resets in-memory buffer', async () => {
    const adapter = new AsyncStorageAnalyticsAdapter();
    adapter.track('event.a');
    await flushPersist();
    await adapter.clearEvents();
    const events = await adapter.getEvents();
    expect(events).toHaveLength(0);
  });
});
