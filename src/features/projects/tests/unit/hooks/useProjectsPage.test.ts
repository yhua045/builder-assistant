/**
 * Unit tests for useProjectsPage View-Model Facade hook
 * Design: design/issue-210-projects-page-refactor.md §8.1
 *
 * Acceptance criteria:
 * - Returns projectDtos: [] and hasProjects: false when useProjects returns empty array.
 * - Correctly maps a ProjectDetails fixture → ProjectCardDto (all fields).
 * - Falls back to project.name for owner when project.owner.name is absent.
 * - Falls back to project.location for address when property.address is absent.
 * - Falls back to 'No Address' when both property.address and location are absent.
 * - createdAt undefined → lastCompletedTask.completedDate is '-'.
 * - openCreate() increments createKey by 1 each call.
 * - navigateToProject('proj-1') calls navigation.navigate('ProjectDetail', { projectId: 'proj-1' }).
 * - loading and error pass through from useProjects.
 */

import { renderHook, act } from '@testing-library/react-native';

// ── Module mocks (must be hoisted before imports) ────────────────────────────

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}));

jest.mock('../../../hooks/useProjects', () => ({
  useProjects: jest.fn(),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { useNavigation } from '@react-navigation/native';
import { useProjects } from '../../../hooks/useProjects';
import { useProjectsPage } from '../../../hooks/useProjectsPage';
import { ProjectStatus } from '../../../../../domain/entities/Project';
import type { ProjectDetails } from '../../../../../domain/entities/ProjectDetails';

// ── Typed mock helpers ───────────────────────────────────────────────────────

const mockNavigate = jest.fn();
const mockUseNavigation = useNavigation as jest.MockedFunction<typeof useNavigation>;
const mockUseProjects = useProjects as jest.MockedFunction<typeof useProjects>;

const DEFAULT_USE_PROJECTS_RETURN = {
  projects: [] as ProjectDetails[],
  loading: false,
  error: null,
  createProject: jest.fn(),
  getProjectAnalysis: jest.fn(),
  refreshProjects: jest.fn(),
};

const FULL_PROJECT_FIXTURE: ProjectDetails = {
  id: 'proj-1',
  name: 'Test Project',
  status: ProjectStatus.IN_PROGRESS,
  materials: [],
  phases: [],
  owner: {
    id: 'owner-1',
    name: 'Jane Smith',
    phone: '0400 000 001',
    email: 'jane@example.com',
  },
  property: {
    id: 'prop-1',
    address: '123 Main St',
  },
  upcomingTasks: [{ title: 'Frame walls', dueDate: '2026-06-01' }],
  createdAt: new Date('2026-01-15'),
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useProjectsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseNavigation.mockReturnValue({ navigate: mockNavigate } as any);
    mockUseProjects.mockReturnValue({ ...DEFAULT_USE_PROJECTS_RETURN });
  });

  // ── Data state mapping ────────────────────────────────────────────────────

  describe('data state mapping', () => {
    it('returns empty projectDtos and hasProjects=false when useProjects returns []', () => {
      mockUseProjects.mockReturnValue({ ...DEFAULT_USE_PROJECTS_RETURN, projects: [] });

      const { result } = renderHook(() => useProjectsPage());

      expect(result.current.projectDtos).toEqual([]);
      expect(result.current.hasProjects).toBe(false);
    });

    it('passes through loading=true from useProjects', () => {
      mockUseProjects.mockReturnValue({ ...DEFAULT_USE_PROJECTS_RETURN, loading: true });

      const { result } = renderHook(() => useProjectsPage());

      expect(result.current.loading).toBe(true);
    });

    it('passes through error string from useProjects', () => {
      mockUseProjects.mockReturnValue({ ...DEFAULT_USE_PROJECTS_RETURN, error: 'DB error' });

      const { result } = renderHook(() => useProjectsPage());

      expect(result.current.error).toBe('DB error');
    });

    it('sets hasProjects=true when projects are returned', () => {
      mockUseProjects.mockReturnValue({
        ...DEFAULT_USE_PROJECTS_RETURN,
        projects: [FULL_PROJECT_FIXTURE],
      });

      const { result } = renderHook(() => useProjectsPage());

      expect(result.current.hasProjects).toBe(true);
      expect(result.current.projectDtos).toHaveLength(1);
    });
  });

  // ── toProjectCardDto mapping ──────────────────────────────────────────────

  describe('ProjectDetails → ProjectCardDto mapping', () => {
    it('correctly maps all fields from a full ProjectDetails fixture', () => {
      mockUseProjects.mockReturnValue({
        ...DEFAULT_USE_PROJECTS_RETURN,
        projects: [FULL_PROJECT_FIXTURE],
      });

      const { result } = renderHook(() => useProjectsPage());

      const dto = result.current.projectDtos[0];
      expect(dto.id).toBe('proj-1');
      expect(dto.owner).toBe('Jane Smith');
      expect(dto.address).toBe('123 Main St');
      expect(dto.status).toBe(ProjectStatus.IN_PROGRESS);
      expect(dto.contact).toBe('0400 000 001');
      expect(dto.lastCompletedTask.title).toBe('Initial Setup');
      expect(dto.lastCompletedTask.completedDate).toBe(
        new Date('2026-01-15').toLocaleDateString(),
      );
      expect(dto.upcomingTasks).toEqual([{ title: 'Frame walls', dueDate: '2026-06-01' }]);
    });

    it('falls back to project.name for owner when owner.name is absent', () => {
      const project: ProjectDetails = {
        ...FULL_PROJECT_FIXTURE,
        owner: { id: 'o1', name: '' },
      };
      mockUseProjects.mockReturnValue({ ...DEFAULT_USE_PROJECTS_RETURN, projects: [project] });

      const { result } = renderHook(() => useProjectsPage());

      expect(result.current.projectDtos[0].owner).toBe('Test Project');
    });

    it('falls back to project.location for address when property.address is absent', () => {
      const project: ProjectDetails = {
        ...FULL_PROJECT_FIXTURE,
        property: { id: 'prop-1', address: '' },
        location: '456 Side St',
      };
      mockUseProjects.mockReturnValue({ ...DEFAULT_USE_PROJECTS_RETURN, projects: [project] });

      const { result } = renderHook(() => useProjectsPage());

      expect(result.current.projectDtos[0].address).toBe('456 Side St');
    });

    it('falls back to "No Address" when both property.address and location are absent', () => {
      const project: ProjectDetails = {
        ...FULL_PROJECT_FIXTURE,
        property: undefined,
        location: undefined,
      };
      mockUseProjects.mockReturnValue({ ...DEFAULT_USE_PROJECTS_RETURN, projects: [project] });

      const { result } = renderHook(() => useProjectsPage());

      expect(result.current.projectDtos[0].address).toBe('No Address');
    });

    it('falls back to email for contact when phone is absent', () => {
      const project: ProjectDetails = {
        ...FULL_PROJECT_FIXTURE,
        owner: { id: 'o1', name: 'Jane', email: 'jane@example.com' },
      };
      mockUseProjects.mockReturnValue({ ...DEFAULT_USE_PROJECTS_RETURN, projects: [project] });

      const { result } = renderHook(() => useProjectsPage());

      expect(result.current.projectDtos[0].contact).toBe('jane@example.com');
    });

    it('uses "No contact" when both owner.phone and owner.email are absent', () => {
      const project: ProjectDetails = {
        ...FULL_PROJECT_FIXTURE,
        owner: { id: 'o1', name: 'Jane' },
      };
      mockUseProjects.mockReturnValue({ ...DEFAULT_USE_PROJECTS_RETURN, projects: [project] });

      const { result } = renderHook(() => useProjectsPage());

      expect(result.current.projectDtos[0].contact).toBe('No contact');
    });

    it('uses "-" for lastCompletedTask.completedDate when createdAt is undefined', () => {
      const project: ProjectDetails = {
        ...FULL_PROJECT_FIXTURE,
        createdAt: undefined,
      };
      mockUseProjects.mockReturnValue({ ...DEFAULT_USE_PROJECTS_RETURN, projects: [project] });

      const { result } = renderHook(() => useProjectsPage());

      expect(result.current.projectDtos[0].lastCompletedTask.completedDate).toBe('-');
    });
  });

  // ── createKey / openCreate ────────────────────────────────────────────────

  describe('createKey state', () => {
    it('starts at 0', () => {
      const { result } = renderHook(() => useProjectsPage());

      expect(result.current.createKey).toBe(0);
    });

    it('increments createKey by 1 on each openCreate() call', () => {
      const { result } = renderHook(() => useProjectsPage());

      act(() => {
        result.current.openCreate();
      });
      expect(result.current.createKey).toBe(1);

      act(() => {
        result.current.openCreate();
      });
      expect(result.current.createKey).toBe(2);
    });
  });

  // ── navigation ────────────────────────────────────────────────────────────

  describe('navigation', () => {
    it('calls navigation.navigate("ProjectDetail", { projectId }) when navigateToProject is called', () => {
      const { result } = renderHook(() => useProjectsPage());

      act(() => {
        result.current.navigateToProject('proj-1');
      });

      expect(mockNavigate).toHaveBeenCalledWith('ProjectDetail', { projectId: 'proj-1' });
    });
  });
});
