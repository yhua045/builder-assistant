/**
 * Unit Tests: useUpdateProject
 *
 * Track D — Step 10 (Issue #176)
 * Asserts: delegates to UpdateProjectUseCase, triggers projectEdited invalidation,
 * exposes loading flag, and forwards errors correctly.
 */

// React not needed in this test file
import { act } from 'react-test-renderer';
import { container } from 'tsyringe';
import { useUpdateProject } from '../../src/hooks/useUpdateProject';
import { renderHookWithQuery } from '../utils/queryClientWrapper';

// ─── mock DI container resolution ─────────────────────────────────────────────
const mockRepo: any = {
  findById: jest.fn(),
  save: jest.fn(),
  list: jest.fn(),
};

// ─── mock UpdateProjectUseCase ─────────────────────────────────────────────────
const mockExecute = jest.fn();

jest.mock('../../src/application/usecases/project/UpdateProjectUseCase', () => ({
  UpdateProjectUseCase: jest.fn().mockImplementation(() => ({
    execute: mockExecute,
  })),
}));

describe('useUpdateProject hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(container, 'resolve').mockReturnValue(mockRepo);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── initial state ──────────────────────────────────────────────────────────

  it('exposes loading=false initially', () => {
    const { result } = renderHookWithQuery(() => useUpdateProject());
    expect(result.current.loading).toBe(false);
  });

  // ── success path ───────────────────────────────────────────────────────────

  it('calls UpdateProjectUseCase.execute and returns success result', async () => {
    mockExecute.mockResolvedValueOnce({ success: true });

    const { result } = renderHookWithQuery(() => useUpdateProject());

    let response: any;
    await act(async () => {
      response = await result.current.updateProject({
        projectId: 'proj-001',
        name: 'Updated',
      });
    });

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'proj-001', name: 'Updated' }),
    );
    expect(response).toEqual({ success: true });
  });

  // ── failure forwarding ────────────────────────────────────────────────────

  it('forwards errors from the use case', async () => {
    mockExecute.mockResolvedValueOnce({
      success: false,
      errors: ['Project name is required'],
    });

    const { result } = renderHookWithQuery(() => useUpdateProject());

    let response: any;
    await act(async () => {
      response = await result.current.updateProject({
        projectId: 'proj-001',
        name: '',
      });
    });

    expect(response.success).toBe(false);
    expect(response.errors).toContain('Project name is required');
  });

  // ── invalidation ──────────────────────────────────────────────────────────

  it('invalidates projectEdited queries on success', async () => {
    mockExecute.mockResolvedValueOnce({ success: true });

    const { result, queryClient } = renderHookWithQuery(() => useUpdateProject());

    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await result.current.updateProject({ projectId: 'proj-abc', name: 'Test' });
    });

    // Should have been called 3 times: projects(), projectsOverview(), projectDetail('proj-abc')
    const calledKeys = invalidateSpy.mock.calls.map(c => (c[0] as any).queryKey);
    expect(calledKeys).toEqual(
      expect.arrayContaining([
        ['projects'],
        ['projectsOverview'],
        ['projectDetail', 'proj-abc'],
      ]),
    );
  });

  it('does NOT invalidate queries when the use case returns failure', async () => {
    mockExecute.mockResolvedValueOnce({ success: false, errors: ['Not found'] });

    const { result, queryClient } = renderHookWithQuery(() => useUpdateProject());

    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    await act(async () => {
      await result.current.updateProject({ projectId: 'ghost', name: 'X' });
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
