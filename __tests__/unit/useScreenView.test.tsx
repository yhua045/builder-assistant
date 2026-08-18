/**
 * Unit tests for useScreenView hook.
 *
 * AC-1: Emits exactly one screen view event on mount via adapter.screen().
 * AC-3: Does not re-fire on re-renders.
 * AC-6: Unit tests verify event emission.
 */

import { renderHook } from '@testing-library/react-native';

// ── Module mocks (hoisted) ────────────────────────────────────────────────────

const mockScreen = jest.fn();

jest.mock('../../src/shared/ui/hooks/useAnalytics', () => ({
  useAnalytics: () => ({ track: jest.fn(), screen: mockScreen }),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { useScreenView } from '../../src/shared/ui/hooks/useScreenView';

describe('useScreenView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls screen() with the screen name on mount', () => {
    renderHook(() => useScreenView('Dashboard'));
    expect(mockScreen).toHaveBeenCalledTimes(1);
    expect(mockScreen).toHaveBeenCalledWith('Dashboard', undefined);
  });

  it('passes additional properties to screen()', () => {
    renderHook(() => useScreenView('ProjectDetail', { project_id: 'abc' }));
    expect(mockScreen).toHaveBeenCalledWith('ProjectDetail', { project_id: 'abc' });
  });

  it('does NOT re-fire on re-render', () => {
    const { rerender } = renderHook(() => useScreenView('Dashboard'));
    rerender({});
    rerender({});
    expect(mockScreen).toHaveBeenCalledTimes(1);
  });

  it('fires again if the component re-mounts (unmount + mount)', () => {
    const { unmount } = renderHook(() => useScreenView('Dashboard'));
    unmount();
    renderHook(() => useScreenView('Dashboard'));
    expect(mockScreen).toHaveBeenCalledTimes(2);
  });
});
