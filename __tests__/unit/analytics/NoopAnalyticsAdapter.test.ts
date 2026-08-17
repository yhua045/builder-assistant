import { NoopAnalyticsAdapter } from '../../../src/shared/infrastructure/analytics/NoopAnalyticsAdapter';
import { AnalyticsAdapter } from '../../../src/shared/infrastructure/analytics/AnalyticsAdapter';

describe('NoopAnalyticsAdapter', () => {
  let adapter: NoopAnalyticsAdapter;

  beforeEach(() => {
    adapter = new NoopAnalyticsAdapter();
  });

  it('is an instance of AnalyticsAdapter', () => {
    expect(adapter).toBeInstanceOf(AnalyticsAdapter);
  });

  it('records track() calls without throwing', () => {
    expect(() => adapter.track('some_event', { foo: 'bar' })).not.toThrow();
    expect(adapter.getCallsFor('track')).toHaveLength(1);
    expect(adapter.getCallsFor('track')[0].args).toEqual(['some_event', { foo: 'bar' }]);
  });

  it('records screen() calls without throwing', () => {
    expect(() => adapter.screen('Invoices')).not.toThrow();
    expect(adapter.getCallsFor('screen')).toHaveLength(1);
    expect(adapter.getCallsFor('screen')[0].args[0]).toBe('Invoices');
  });

  it('records identify() calls without throwing', () => {
    expect(() => adapter.identify('anon-uuid')).not.toThrow();
    expect(adapter.getCallsFor('identify')).toHaveLength(1);
  });

  it('records reset() calls without throwing', () => {
    expect(() => adapter.reset()).not.toThrow();
    expect(adapter.getCallsFor('reset')).toHaveLength(1);
  });

  it('clearCalls() empties the call record', () => {
    adapter.track('event_one');
    adapter.track('event_two');
    expect(adapter.calls).toHaveLength(2);

    adapter.clearCalls();
    expect(adapter.calls).toHaveLength(0);
  });

  it('accumulates calls across multiple methods', () => {
    adapter.track('event_a');
    adapter.screen('Dashboard');
    adapter.reset();

    expect(adapter.calls).toHaveLength(3);
    expect(adapter.getCallsFor('track')).toHaveLength(1);
    expect(adapter.getCallsFor('screen')).toHaveLength(1);
    expect(adapter.getCallsFor('reset')).toHaveLength(1);
  });
});
