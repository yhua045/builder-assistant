/**
 * Unit tests for AsyncStorageAnalyticsService.
 *
 * AsyncStorage is globally mocked in jest.setup.js via the official
 * @react-native-async-storage/async-storage/jest/async-storage-mock.
 *
 * AC-3: track() is fire-and-forget; persistence is async.
 * AC-4: No PII in the event properties (caller's responsibility — we test
 *        that the service does NOT add any extra properties automatically).
 * Buffer limit: max 500 events; oldest are pruned.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AsyncStorageAnalyticsService } from '../../src/shared/infrastructure/analytics/AsyncStorageAnalyticsService';

const STORAGE_KEY = '@analytics/events';

async function flushPersist() {
  // Flush all pending promises so AsyncStorage writes settle
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('AsyncStorageAnalyticsService', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('track() immediately appends to in-memory state (synchronous from caller PoV)', async () => {
    const svc = new AsyncStorageAnalyticsService();
    svc.track({ name: 'test.event' });
    await flushPersist();
    const events = await svc.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('test.event');
  });

  it('track() stamps timestampUtc as ISO 8601', async () => {
    const before = new Date().toISOString();
    const svc = new AsyncStorageAnalyticsService();
    svc.track({ name: 'test.stamp' });
    await flushPersist();
    const events = await svc.getEvents();
    const after = new Date().toISOString();
    expect(events[0].timestampUtc >= before).toBe(true);
    expect(events[0].timestampUtc <= after).toBe(true);
  });

  it('track() preserves caller-supplied properties', async () => {
    const svc = new AsyncStorageAnalyticsService();
    svc.track({ name: 'task.created', properties: { method: 'voice' } });
    await flushPersist();
    const events = await svc.getEvents();
    expect(events[0].properties).toEqual({ method: 'voice' });
  });

  it('persists events to AsyncStorage after track()', async () => {
    const svc = new AsyncStorageAnalyticsService();
    svc.track({ name: 'persisted.event' });
    await flushPersist();
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw!);
    expect(stored[0].name).toBe('persisted.event');
  });

  it('getEvents() returns empty array when nothing has been tracked', async () => {
    const svc = new AsyncStorageAnalyticsService();
    const events = await svc.getEvents();
    expect(events).toEqual([]);
  });

  it('clearEvents() empties AsyncStorage and resets in-memory buffer', async () => {
    const svc = new AsyncStorageAnalyticsService();
    svc.track({ name: 'event.a' });
    await flushPersist();
    await svc.clearEvents();
    const events = await svc.getEvents();
    expect(events).toHaveLength(0);
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    expect(raw).toBeNull();
  });

  it('prunes oldest events when buffer exceeds 500', async () => {
    const svc = new AsyncStorageAnalyticsService();
    // Pre-seed AsyncStorage with 500 events
    const seedEvents = Array.from({ length: 500 }, (_, i) => ({
      name: `event.seed.${i}`,
      timestampUtc: new Date().toISOString(),
    }));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(seedEvents));

    // Track one more — should prune the oldest
    svc.track({ name: 'event.overflow' });
    await flushPersist();

    const events = await svc.getEvents();
    expect(events).toHaveLength(500);
    // Oldest event (seed.0) should have been pruned
    expect(events.find(e => e.name === 'event.seed.0')).toBeUndefined();
    // Newest event should be present
    expect(events[events.length - 1].name).toBe('event.overflow');
  });

  it('does not add PII fields automatically', async () => {
    const svc = new AsyncStorageAnalyticsService();
    svc.track({ name: 'screen.viewed', properties: { screen: 'Dashboard' } });
    await flushPersist();
    const events = await svc.getEvents();
    const keys = Object.keys(events[0].properties ?? {});
    // Only screen — no user ID, email, name, etc. injected by the service
    expect(keys).toEqual(['screen']);
  });

  it('gracefully returns [] if AsyncStorage contains malformed JSON', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'NOT_VALID_JSON');
    const svc = new AsyncStorageAnalyticsService();
    const events = await svc.getEvents();
    expect(events).toEqual([]);
  });

  it('multiple independent instances share AsyncStorage persistence', async () => {
    const svc1 = new AsyncStorageAnalyticsService();
    svc1.track({ name: 'from.svc1' });
    await flushPersist();

    const svc2 = new AsyncStorageAnalyticsService();
    const events = await svc2.getEvents();
    expect(events.some(e => e.name === 'from.svc1')).toBe(true);
  });
});
