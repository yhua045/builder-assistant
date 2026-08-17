import { CompositeAnalyticsAdapter } from '../../../src/shared/infrastructure/analytics/CompositeAnalyticsAdapter';
import { NoopAnalyticsAdapter } from '../../../src/shared/infrastructure/analytics/NoopAnalyticsAdapter';

describe('CompositeAnalyticsAdapter', () => {
  let adapterA: NoopAnalyticsAdapter;
  let adapterB: NoopAnalyticsAdapter;

  beforeEach(() => {
    adapterA = new NoopAnalyticsAdapter();
    adapterB = new NoopAnalyticsAdapter();
  });

  describe('fan-out to all child adapters', () => {
    it('forwards track() to every child adapter', () => {
      const composite = new CompositeAnalyticsAdapter([adapterA, adapterB]);
      composite.track('test_event', { key: 'value' });

      expect(adapterA.getCallsFor('track')).toHaveLength(1);
      expect(adapterA.getCallsFor('track')[0].args).toEqual(['test_event', { key: 'value' }]);
      expect(adapterB.getCallsFor('track')).toHaveLength(1);
    });

    it('forwards screen() to every child adapter', () => {
      const composite = new CompositeAnalyticsAdapter([adapterA, adapterB]);
      composite.screen('Dashboard');

      expect(adapterA.getCallsFor('screen')).toHaveLength(1);
      expect(adapterA.getCallsFor('screen')[0].args[0]).toBe('Dashboard');
      expect(adapterB.getCallsFor('screen')).toHaveLength(1);
    });

    it('forwards identify() to every child adapter', () => {
      const composite = new CompositeAnalyticsAdapter([adapterA, adapterB]);
      composite.identify('user-123', { role: 'owner' });

      expect(adapterA.getCallsFor('identify')).toHaveLength(1);
      expect(adapterA.getCallsFor('identify')[0].args).toEqual(['user-123', { role: 'owner' }]);
      expect(adapterB.getCallsFor('identify')).toHaveLength(1);
    });

    it('forwards reset() to every child adapter', () => {
      const composite = new CompositeAnalyticsAdapter([adapterA, adapterB]);
      composite.reset();

      expect(adapterA.getCallsFor('reset')).toHaveLength(1);
      expect(adapterB.getCallsFor('reset')).toHaveLength(1);
    });

    it('works with a single child adapter', () => {
      const composite = new CompositeAnalyticsAdapter([adapterA]);
      composite.track('solo_event');

      expect(adapterA.getCallsFor('track')).toHaveLength(1);
    });
  });

  describe('opt-out suppression', () => {
    it('suppresses all calls when optOutProvider returns true', () => {
      const composite = new CompositeAnalyticsAdapter([adapterA, adapterB], () => true);

      composite.track('test_event');
      composite.screen('Dashboard');
      composite.identify('user-123');
      composite.reset();

      expect(adapterA.calls).toHaveLength(0);
      expect(adapterB.calls).toHaveLength(0);
    });

    it('forwards calls when optOutProvider returns false', () => {
      const composite = new CompositeAnalyticsAdapter([adapterA, adapterB], () => false);
      composite.track('test_event');

      expect(adapterA.calls).toHaveLength(1);
      expect(adapterB.calls).toHaveLength(1);
    });

    it('uses default opt-out of false when no provider is given', () => {
      const composite = new CompositeAnalyticsAdapter([adapterA]);
      composite.track('default_event');

      expect(adapterA.calls).toHaveLength(1);
    });

    it('evaluates optOutProvider on each call (reactive)', () => {
      let optedOut = false;
      const composite = new CompositeAnalyticsAdapter([adapterA], () => optedOut);

      composite.track('event_before_opt_out');
      optedOut = true;
      composite.track('event_after_opt_out');

      expect(adapterA.getCallsFor('track')).toHaveLength(1);
      expect(adapterA.getCallsFor('track')[0].args[0]).toBe('event_before_opt_out');
    });
  });
});
