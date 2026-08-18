/**
 * Analytics instrumentation tests for useProjectsPage.
 *
 * Verifies project card tap and creation started events.
 *
 * AC-1: Events use namespaced names from design taxonomy.
 * AC-6: Unit tests verify event emission.
 */

import { renderHook, act } from '@testing-library/react-native';

// ── Module mocks (hoisted) ────────────────────────────────────────────────────

const mockTrack = jest.fn();

jest.mock('../../src/shared/ui/hooks/useAnalytics', () => ({
  useAnalytics: () => ({ track: mockTrack, screen: jest.fn() }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}));

jest.mock('../../src/features/projects/hooks/useProjects', () => ({
  useProjects: jest.fn(),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { useNavigation } from '@react-navigation/native';
import { useProjects } from '../../src/features/projects/hooks/useProjects';
import { useProjectsPage } from '../../src/features/projects/hooks/useProjectsPage';

const mockNavigate = jest.fn();
const mockUseNavigation = useNavigation as jest.MockedFunction<typeof useNavigation>;
const mockUseProjects = useProjects as jest.MockedFunction<typeof useProjects>;

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useProjectsPage — analytics instrumentation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNavigation.mockReturnValue({ navigate: mockNavigate } as any);
    mockUseProjects.mockReturnValue({ projects: [], loading: false, error: null } as any);
  });

  it('openCreate emits project.creation_started', () => {
    const { result } = renderHook(() => useProjectsPage());
    act(() => result.current.openCreate());
    expect(mockTrack).toHaveBeenCalledWith('project.creation_started');
  });

  it('navigateToProject emits project.card_tapped', () => {
    const { result } = renderHook(() => useProjectsPage());
    act(() => result.current.navigateToProject('project-123'));
    expect(mockTrack).toHaveBeenCalledWith('project.card_tapped');
  });

  it('navigateToProject still calls navigation.navigate after tracking', () => {
    const { result } = renderHook(() => useProjectsPage());
    act(() => result.current.navigateToProject('project-xyz'));
    expect(mockNavigate).toHaveBeenCalledWith('ProjectDetail', { projectId: 'project-xyz' });
  });

  it('openCreate increments createKey (existing behaviour preserved)', () => {
    const { result } = renderHook(() => useProjectsPage());
    const keyBefore = result.current.createKey;
    act(() => result.current.openCreate());
    expect(result.current.createKey).toBe(keyBefore + 1);
  });

  it('track is not called during initial render', () => {
    renderHook(() => useProjectsPage());
    expect(mockTrack).not.toHaveBeenCalled();
  });
});
