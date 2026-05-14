/**
 * Contract tests for IAnalyticsService.
 *
 * Run against NullAnalyticsService — any implementation that passes these
 * tests satisfies the AC-5 pluggability contract.
 *
 * AC-1: Events are tracked with correct name and properties.
 * AC-6: Unit tests verify event emission.
 */

import { NullAnalyticsService } from '../../src/infrastructure/analytics/NullAnalyticsService';
import type { IAnalyticsService } from '../../src/application/services/IAnalyticsService';

function makeService(): IAnalyticsService {
  return new NullAnalyticsService();
}

describe('IAnalyticsService contract — NullAnalyticsService', () => {
  it('track() appends an event with a timestampUtc', async () => {
    const svc = makeService();
    svc.track({ name: 'test.event' });
    const events = await svc.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('test.event');
    expect(events[0].timestampUtc).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('track() preserves properties passed by the caller', async () => {
    const svc = makeService();
    svc.track({ name: 'task.created', properties: { method: 'voice' } });
    const events = await svc.getEvents();
    expect(events[0].properties).toEqual({ method: 'voice' });
  });

  it('track() works with no properties', async () => {
    const svc = makeService();
    svc.track({ name: 'dashboard.quick_actions_opened' });
    const events = await svc.getEvents();
    expect(events[0].name).toBe('dashboard.quick_actions_opened');
    expect(events[0].properties).toBeUndefined();
  });

  it('trackScreen() emits a "screen.viewed" event with screen property', async () => {
    const svc = makeService();
    svc.trackScreen('Dashboard');
    const events = await svc.getEvents();
    expect(events).toHaveLength(1);
    expect(events[0].name).toBe('screen.viewed');
    expect(events[0].properties?.screen).toBe('Dashboard');
  });

  it('trackScreen() merges additional properties', async () => {
    const svc = makeService();
    svc.trackScreen('ProjectDetail', { project_count: 3 });
    const events = await svc.getEvents();
    expect(events[0].properties).toMatchObject({ screen: 'ProjectDetail', project_count: 3 });
  });

  it('getEvents() returns accumulated events in insertion order', async () => {
    const svc = makeService();
    svc.track({ name: 'event.a' });
    svc.track({ name: 'event.b' });
    svc.track({ name: 'event.c' });
    const events = await svc.getEvents();
    expect(events.map(e => e.name)).toEqual(['event.a', 'event.b', 'event.c']);
  });

  it('clearEvents() empties the event buffer', async () => {
    const svc = makeService();
    svc.track({ name: 'event.a' });
    await svc.clearEvents();
    const events = await svc.getEvents();
    expect(events).toHaveLength(0);
  });

  it('getEvents() returns a copy — mutations do not affect the internal buffer', async () => {
    const svc = makeService();
    svc.track({ name: 'event.a' });
    const first = await svc.getEvents();
    first.push({ name: 'injected', timestampUtc: '' });
    const second = await svc.getEvents();
    expect(second).toHaveLength(1);
  });

  it('multiple track() calls accumulate correctly', async () => {
    const svc = makeService();
    for (let i = 0; i < 5; i++) {
      svc.track({ name: `event.${i}` });
    }
    const events = await svc.getEvents();
    expect(events).toHaveLength(5);
  });
});
