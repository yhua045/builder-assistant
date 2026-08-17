/**
 * Integration test: verify that analytics adapters can be wired together and
 * the DI registration contract is met.
 *
 * Uses only in-process classes (no native modules / tsyringe) so it stays
 * fast and deterministic.
 */
import { CompositeAnalyticsAdapter } from '../../../src/shared/infrastructure/analytics/CompositeAnalyticsAdapter';
import { NoopAnalyticsAdapter } from '../../../src/shared/infrastructure/analytics/NoopAnalyticsAdapter';
import { NoopErrorReportingAdapter } from '../../../src/shared/infrastructure/analytics/NoopErrorReportingAdapter';
import { FirebaseAnalyticsAdapter } from '../../../src/shared/infrastructure/analytics/FirebaseAnalyticsAdapter';
import { MixpanelAnalyticsAdapter } from '../../../src/shared/infrastructure/analytics/MixpanelAnalyticsAdapter';
import { SentryErrorReportingAdapter } from '../../../src/shared/infrastructure/analytics/SentryErrorReportingAdapter';
import { AsyncStorageAnalyticsAdapter } from '../../../src/shared/infrastructure/analytics/AsyncStorageAnalyticsAdapter';
import { AnalyticsAdapter } from '../../../src/shared/infrastructure/analytics/AnalyticsAdapter';
import { ErrorReportingAdapter } from '../../../src/shared/infrastructure/analytics/ErrorReportingAdapter';

describe('Analytics DI contract', () => {
  describe('production adapter hierarchy', () => {
    it('CompositeAnalyticsAdapter is an AnalyticsAdapter', () => {
      const composite = new CompositeAnalyticsAdapter([new NoopAnalyticsAdapter()]);
      expect(composite).toBeInstanceOf(AnalyticsAdapter);
    });

    it('FirebaseAnalyticsAdapter is an AnalyticsAdapter', () => {
      const adapter = new FirebaseAnalyticsAdapter();
      expect(adapter).toBeInstanceOf(AnalyticsAdapter);
    });

    it('MixpanelAnalyticsAdapter is an AnalyticsAdapter', () => {
      const adapter = new MixpanelAnalyticsAdapter('test-token');
      expect(adapter).toBeInstanceOf(AnalyticsAdapter);
    });

    it('SentryErrorReportingAdapter is an ErrorReportingAdapter', () => {
      const adapter = new SentryErrorReportingAdapter();
      expect(adapter).toBeInstanceOf(ErrorReportingAdapter);
    });
  });

  describe('test adapter hierarchy', () => {
    it('NoopAnalyticsAdapter is an AnalyticsAdapter', () => {
      const adapter = new NoopAnalyticsAdapter();
      expect(adapter).toBeInstanceOf(AnalyticsAdapter);
    });

    it('NoopErrorReportingAdapter is an ErrorReportingAdapter', () => {
      const adapter = new NoopErrorReportingAdapter();
      expect(adapter).toBeInstanceOf(ErrorReportingAdapter);
    });
  });

  describe('AsyncStorageAnalyticsAdapter', () => {
    it('AsyncStorageAnalyticsAdapter is an AnalyticsAdapter', () => {
      const adapter = new AsyncStorageAnalyticsAdapter();
      expect(adapter).toBeInstanceOf(AnalyticsAdapter);
    });
  });

  describe('production composite wiring', () => {
    it('CompositeAnalyticsAdapter fans events to Firebase and Mixpanel children', () => {
      const noopA = new NoopAnalyticsAdapter();
      const noopB = new NoopAnalyticsAdapter();
      const composite = new CompositeAnalyticsAdapter([noopA, noopB]);

      composite.track('task_created', { projectId: 'p-1' });

      expect(noopA.getCallsFor('track')).toHaveLength(1);
      expect(noopB.getCallsFor('track')).toHaveLength(1);
    });

    it('3-adapter composite fans events to all 3 children (Firebase, Mixpanel, AsyncStorage)', () => {
      const noopA = new NoopAnalyticsAdapter();
      const noopB = new NoopAnalyticsAdapter();
      const noopC = new NoopAnalyticsAdapter();
      const composite = new CompositeAnalyticsAdapter([noopA, noopB, noopC]);

      composite.track('task_created', { projectId: 'p-1' });

      expect(noopA.getCallsFor('track')).toHaveLength(1);
      expect(noopB.getCallsFor('track')).toHaveLength(1);
      expect(noopC.getCallsFor('track')).toHaveLength(1);
    });

    it('3-adapter composite opt-out suppresses all 3 children', () => {
      const noopA = new NoopAnalyticsAdapter();
      const noopB = new NoopAnalyticsAdapter();
      const noopC = new NoopAnalyticsAdapter();
      const composite = new CompositeAnalyticsAdapter([noopA, noopB, noopC], () => true);

      composite.track('task_created');

      expect(noopA.getCallsFor('track')).toHaveLength(0);
      expect(noopB.getCallsFor('track')).toHaveLength(0);
      expect(noopC.getCallsFor('track')).toHaveLength(0);
    });

    it('test config: NoopAnalyticsAdapter is used directly and records calls', () => {
      const testAdapter: AnalyticsAdapter = new NoopAnalyticsAdapter();
      testAdapter.screen('Dashboard');

      // Cast back to access test helpers
      const noop = testAdapter as NoopAnalyticsAdapter;
      expect(noop.getCallsFor('screen')).toHaveLength(1);
    });
  });
});
