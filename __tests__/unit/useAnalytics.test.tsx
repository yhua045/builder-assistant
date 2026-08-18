/**
 * Unit tests for useAnalytics hook.
 *
 * AC-4: Hook resolves AnalyticsAdapter from tsyringe (token: 'AnalyticsAdapter');
 *       falls back to NoopAnalyticsAdapter.
 * AC-3: track/screen calls are fire-and-forget and never throw.
 * AC-6: Unit tests verify event emission (via NoopAnalyticsAdapter).
 */

import { renderHook, act } from '@testing-library/react-native';

// ── Module mocks (hoisted) ────────────────────────────────────────────────────

jest.mock('tsyringe', () => ({
  container: { resolve: jest.fn() },
  injectable: jest.fn(),
  inject: jest.fn(),
  singleton: jest.fn(),
  registry: jest.fn(),
}));

jest.mock('../../src/infrastructure/di/registerServices', () => ({}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { container } from 'tsyringe';
import { useAnalytics } from '../../src/shared/ui/hooks/useAnalytics';
import { NoopAnalyticsAdapter } from '../../src/shared/infrastructure/analytics/NoopAnalyticsAdapter';

const mockResolve = container.resolve as jest.MockedFunction<typeof container.resolve>;

describe('useAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves the AnalyticsAdapter token from the DI container', () => {
    const adapter = new NoopAnalyticsAdapter();
    mockResolve.mockReturnValue(adapter as any);
    renderHook(() => useAnalytics());
    expect(mockResolve).toHaveBeenCalledWith('AnalyticsAdapter');
  });

  it('returns track and screen functions', () => {
    mockResolve.mockReturnValue(new NoopAnalyticsAdapter() as any);
    const { result } = renderHook(() => useAnalytics());
    expect(typeof result.current.track).toBe('function');
    expect(typeof result.current.screen).toBe('function');
  });

  it('calls adapter.track() with (event, properties) when track() is invoked', () => {
    const adapter = new NoopAnalyticsAdapter();
    const spy = jest.spyOn(adapter, 'track');
    mockResolve.mockReturnValue(adapter as any);

    const { result } = renderHook(() => useAnalytics());
    act(() => {
      result.current.track('test.event', { method: 'voice' });
    });
    expect(spy).toHaveBeenCalledWith('test.event', { method: 'voice' });
  });

  it('calls adapter.track() with no properties when called with event only', () => {
    const adapter = new NoopAnalyticsAdapter();
    const spy = jest.spyOn(adapter, 'track');
    mockResolve.mockReturnValue(adapter as any);

    const { result } = renderHook(() => useAnalytics());
    act(() => {
      result.current.track('receipt.snap_started');
    });
    expect(spy).toHaveBeenCalledWith('receipt.snap_started', undefined);
  });

  it('calls adapter.screen() when screen() is invoked', () => {
    const adapter = new NoopAnalyticsAdapter();
    const spy = jest.spyOn(adapter, 'screen');
    mockResolve.mockReturnValue(adapter as any);

    const { result } = renderHook(() => useAnalytics());
    act(() => {
      result.current.screen('Dashboard', { from: 'test' });
    });
    expect(spy).toHaveBeenCalledWith('Dashboard', { from: 'test' });
  });

  it('falls back to NoopAnalyticsAdapter when tsyringe resolve throws', () => {
    mockResolve.mockImplementation(() => { throw new Error('not registered'); });

    const { result } = renderHook(() => useAnalytics());
    // Should not throw — fallback is NoopAnalyticsAdapter
    expect(() => act(() => {
      result.current.track('fallback.event');
    })).not.toThrow();
  });

  it('track() does not throw even if the adapter throws internally', () => {
    const adapter = new NoopAnalyticsAdapter();
    jest.spyOn(adapter, 'track').mockImplementation(() => { throw new Error('oops'); });
    mockResolve.mockReturnValue(adapter as any);

    const { result } = renderHook(() => useAnalytics());
    expect(() => act(() => {
      result.current.track('boom');
    })).not.toThrow();
  });

  it('screen() does not throw even if the adapter throws internally', () => {
    const adapter = new NoopAnalyticsAdapter();
    jest.spyOn(adapter, 'screen').mockImplementation(() => { throw new Error('oops'); });
    mockResolve.mockReturnValue(adapter as any);

    const { result } = renderHook(() => useAnalytics());
    expect(() => act(() => {
      result.current.screen('CrashScreen');
    })).not.toThrow();
  });

  it('track and screen are stable across re-renders', () => {
    const adapter = new NoopAnalyticsAdapter();
    mockResolve.mockReturnValue(adapter as any);

    const { result, rerender } = renderHook(() => useAnalytics());
    const { track: t1, screen: s1 } = result.current;
    rerender({});
    const { track: t2, screen: s2 } = result.current;
    expect(t1).toBe(t2);
    expect(s1).toBe(s2);
  });
});
