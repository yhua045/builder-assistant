import { renderHook, act } from '@testing-library/react-hooks';
import { container } from 'tsyringe';
import { useProjects } from '../../src/hooks/useProjects';

describe('useProjects hook', () => {
  const mockRepo: any = {
    list: jest.fn(),
    save: jest.fn(),
    findById: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(container, 'resolve').mockReturnValue(mockRepo);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads projects on mount (success)', async () => {
    const projects = [{ id: 'p1', name: 'P1', materials: [], phases: [], status: 'in_progress' }];
    mockRepo.list.mockResolvedValueOnce({ items: projects, meta: {} });

    const { result, waitForNextUpdate } = renderHook(() => useProjects());
    await waitForNextUpdate(); // wait for initial load

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.projects).toHaveLength(1);
    expect(mockRepo.list).toHaveBeenCalledTimes(1);
  });

  it('sets error when initial load fails', async () => {
    mockRepo.list.mockRejectedValueOnce(new Error('DB error'));

    const { result, waitForNextUpdate } = renderHook(() => useProjects());
    await waitForNextUpdate();

    expect(result.current.loading).toBe(false);
    expect(result.current.projects).toHaveLength(0);
    expect(result.current.error).toContain('DB error');
  });

  it('createProject refreshes list on success', async () => {
    // Sequence: initial load -> create use-case list check -> refresh list
    mockRepo.list
      .mockResolvedValueOnce({ items: [], meta: {} }) // initial
      .mockResolvedValueOnce({ items: [], meta: {} }) // create use-case check
      .mockResolvedValueOnce({ items: [{ id: 'p2', name: 'New', materials: [], phases: [], status: 'planning' }], meta: {} }); // refreshed

    mockRepo.save.mockResolvedValueOnce(undefined);

    const { result, waitForNextUpdate } = renderHook(() => useProjects());
    await waitForNextUpdate(); // initial

    await act(async () => {
      const res = await result.current.createProject({
        name: 'New',
        description: 'desc',
        budget: 1000,
        startDate: new Date(),
        expectedEndDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 40),
      } as any);

      expect(res.success).toBe(true);
    });

    // After createProject completes, refresh should have run
    expect(result.current.projects.find((p: any) => p.id === 'p2')).toBeTruthy();
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
    expect(mockRepo.list).toHaveBeenCalledTimes(3);
  });
});
