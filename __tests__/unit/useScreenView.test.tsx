/**
 * Unit tests for useScreenView hook.
 *
 * AC-1: Emits exactly one "screen.viewed" event on mount.
 * AC-3: Does not re-fire on re-renders.
 * AC-6: Unit tests verify event emission.
 */

import { renderHook } from '@testing-library/react-native';

// ── Module mocks (hoisted) ────────────────────────────────────────────────────

const mockTrackScreen = jest.fn();

jest.mock('../../src/hooks/useAnalytics', () => ({
  useAnalytics: () => ({ track: jest.fn(), trackScreen: mockTrackScreen }),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { useScreenView } from '../../src/hooks/useScreenView';

describe('useScreenView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls trackScreen with the screen name on mount', () => {
    renderHook(() => useScreenView('Dashboard'));
    expect(mockTrackScreen).toHaveBeenCalledTimes(1);
    expect(mockTrackScreen).toHaveBeenCalledWith('Dashboard', undefined);
  });

  it('passes additional properties to trackScreen', () => {
    renderHook(() => useScreenView('ProjectDetail', { project_id: 'abc' }));
    expect(mockTrackScreen).toHaveBeenCalledWith('ProjectDetail', { project_id: 'abc' });
  });

  it('does NOT re-fire on re-render', () => {
    const { rerender } = renderHook(() => useScreenView('Dashboard'));
    rerender({});
    rerender({});
    expect(mockTrackScreen).toHaveBeenCalledTimes(1);
  });

  it('fires again if the component re-mounts (unmount + mount)', () => {
    const { unmount } = renderHook(() => useScreenView('Dashboard'));
    unmount();
    renderHook(() => useScreenView('Dashboard'));
    expect(mockTrackScreen).toHaveBeenCalledTimes(2);
  });
});
