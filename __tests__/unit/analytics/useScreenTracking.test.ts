import { renderHook } from '@testing-library/react-native';
import { NoopAnalyticsAdapter } from '../../../src/shared/infrastructure/analytics/NoopAnalyticsAdapter';

// Mock tsyringe so the hook resolves to our test adapter
const mockAdapter = new NoopAnalyticsAdapter();

jest.mock('tsyringe', () => ({
  container: {
    resolve: jest.fn(() => mockAdapter),
  },
  injectable: () => () => {},
  inject: () => () => {},
  singleton: () => () => {},
  autoInjectable: () => () => {},
}));

// Mock registerServices to prevent real DI registrations in test env
jest.mock('../../../src/infrastructure/di/registerServices', () => ({}));

import { useScreenTracking } from '../../../src/shared/ui/hooks/useScreenTracking';

describe('useScreenTracking', () => {
  beforeEach(() => {
    mockAdapter.clearCalls();
  });

  it('calls analytics.screen() with the screen name on mount', () => {
    renderHook(() => useScreenTracking('Invoices'));

    expect(mockAdapter.getCallsFor('screen')).toHaveLength(1);
    expect(mockAdapter.getCallsFor('screen')[0].args[0]).toBe('Invoices');
  });

  it('fires a screen event for each distinct screen name', () => {
    renderHook(() => useScreenTracking('Dashboard'));
    renderHook(() => useScreenTracking('Tasks'));

    const screenCalls = mockAdapter.getCallsFor('screen');
    expect(screenCalls).toHaveLength(2);
    expect(screenCalls[0].args[0]).toBe('Dashboard');
    expect(screenCalls[1].args[0]).toBe('Tasks');
  });

  it('does not fire an extra screen event on unmount', () => {
    const { unmount } = renderHook(() => useScreenTracking('Payments'));
    const countAfterMount = mockAdapter.getCallsFor('screen').length;

    unmount();

    expect(mockAdapter.getCallsFor('screen')).toHaveLength(countAfterMount);
  });
});
