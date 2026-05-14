/**
 * Unit tests for useAnalytics hook.
 *
 * AC-5: Hook resolves IAnalyticsService from tsyringe; falls back to NullAnalyticsService.
 * AC-3: track/trackScreen calls are fire-and-forget and never throw.
 * AC-6: Unit tests verify event emission (via NullAnalyticsService).
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
import { useAnalytics } from '../../src/hooks/useAnalytics';
import { NullAnalyticsService } from '../../src/infrastructure/analytics/NullAnalyticsService';

const mockResolve = container.resolve as jest.MockedFunction<typeof container.resolve>;

describe('useAnalytics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns track and trackScreen functions', () => {
    mockResolve.mockReturnValue(new NullAnalyticsService() as any);
    const { result } = renderHook(() => useAnalytics());
    expect(typeof result.current.track).toBe('function');
    expect(typeof result.current.trackScreen).toBe('function');
  });

  it('calls service.track() when track() is invoked', () => {
    const svc = new NullAnalyticsService();
    const spy = jest.spyOn(svc, 'track');
    mockResolve.mockReturnValue(svc as any);

    const { result } = renderHook(() => useAnalytics());
    act(() => {
      result.current.track({ name: 'test.event' });
    });
    expect(spy).toHaveBeenCalledWith({ name: 'test.event' });
  });

  it('calls service.trackScreen() when trackScreen() is invoked', () => {
    const svc = new NullAnalyticsService();
    const spy = jest.spyOn(svc, 'trackScreen');
    mockResolve.mockReturnValue(svc as any);

    const { result } = renderHook(() => useAnalytics());
    act(() => {
      result.current.trackScreen('Dashboard', { from: 'test' });
    });
    expect(spy).toHaveBeenCalledWith('Dashboard', { from: 'test' });
  });

  it('falls back to NullAnalyticsService when tsyringe resolve throws', () => {
    mockResolve.mockImplementation(() => { throw new Error('not registered'); });

    const { result } = renderHook(() => useAnalytics());
    // Should not throw — fallback is NullAnalyticsService
    expect(() => act(() => {
      result.current.track({ name: 'fallback.event' });
    })).not.toThrow();
  });

  it('track() does not throw even if the service throws internally', () => {
    const svc = new NullAnalyticsService();
    jest.spyOn(svc, 'track').mockImplementation(() => { throw new Error('oops'); });
    mockResolve.mockReturnValue(svc as any);

    const { result } = renderHook(() => useAnalytics());
    expect(() => act(() => {
      result.current.track({ name: 'boom' });
    })).not.toThrow();
  });

  it('trackScreen() does not throw even if the service throws internally', () => {
    const svc = new NullAnalyticsService();
    jest.spyOn(svc, 'trackScreen').mockImplementation(() => { throw new Error('oops'); });
    mockResolve.mockReturnValue(svc as any);

    const { result } = renderHook(() => useAnalytics());
    expect(() => act(() => {
      result.current.trackScreen('CrashScreen');
    })).not.toThrow();
  });

  it('track and trackScreen are stable across re-renders', () => {
    const svc = new NullAnalyticsService();
    mockResolve.mockReturnValue(svc as any);

    const { result, rerender } = renderHook(() => useAnalytics());
    const { track: t1, trackScreen: ts1 } = result.current;
    rerender({});
    const { track: t2, trackScreen: ts2 } = result.current;
    expect(t1).toBe(t2);
    expect(ts1).toBe(ts2);
  });
});
