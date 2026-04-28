import { renderHookWithQuery } from '../../../../../__tests__/utils/queryClientWrapper';
// React/test renderer imports not required for these tests
import { container } from 'tsyringe';
import { useProjects } from '../../hooks/useProjects';

describe('useProjects hook', () => {
  const mockRepo: any = {
    listDetails: jest.fn(),
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
    mockRepo.listDetails.mockResolvedValueOnce({ items: projects, meta: {} });

    const { result } = renderHookWithQuery(() => useProjects());

    // Wait for loading to complete
    await new Promise<void>(resolve => {
      const checkLoading = setInterval(() => {
        if (!result.current.loading) {
          clearInterval(checkLoading);
          resolve();
        }
      }, 50);
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkLoading);
        resolve();
      }, 5000);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.projects).toHaveLength(1);
    expect(mockRepo.listDetails).toHaveBeenCalledTimes(1);
  });

  it('sets error when initial load fails', async () => {
    mockRepo.listDetails.mockRejectedValueOnce(new Error('DB error'));

    const { result } = renderHookWithQuery(() => useProjects());

    // Wait for loading to complete
    await new Promise<void>(resolve => {
      const checkLoading = setInterval(() => {
        if (!result.current.loading) {
          clearInterval(checkLoading);
          resolve();
        }
      }, 50);
      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkLoading);
        resolve();
      }, 5000);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.projects).toHaveLength(0);
    expect(result.current.error).toContain('DB error');
  });

  it('createProject refreshes list on success', async () => {
    // Sequence: initial load -> refresh list
    // (no uniqueness check because request has no address/projectOwner)
    mockRepo.listDetails
      .mockResolvedValueOnce({ items: [], meta: {} }) // initial
      .mockResolvedValue({ items: [{ id: 'p2', name: 'New', materials: [], phases: [], status: 'planning' }], meta: {} }); // refreshed and any subsequent
    mockRepo.list.mockResolvedValue({ items: [], meta: {} }); // for uniqueness check
    mockRepo.save.mockResolvedValueOnce(undefined);

    const { result } = renderHookWithQuery(() => useProjects());

    // Wait for initial load
    await new Promise<void>(resolve => {
      const checkLoading = setInterval(() => {
        if (!result.current.loading) {
          clearInterval(checkLoading);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(checkLoading);
        resolve();
      }, 5000);
    });

    // Call createProject
    const res = await result.current.createProject({
      name: 'New',
      description: 'desc',
      budget: 1000,
      startDate: new Date(),
      expectedEndDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 40),
    } as any);
    
    expect(res.success).toBe(true);
    
    // Wait for refresh to complete
    await new Promise<void>(resolve => {
      const checkProjects = setInterval(() => {
        if (result.current.projects.find((p: any) => p.id === 'p2')) {
          clearInterval(checkProjects);
          resolve();
        }
      }, 50);
      setTimeout(() => {
        clearInterval(checkProjects);
        resolve();
      }, 5000);
    });

    // After createProject completes, refresh should have run
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
    expect(mockRepo.listDetails.mock.calls.length).toBeGreaterThanOrEqual(2); // initial + refresh
    expect(result.current.projects.find((p: any) => p.id === 'p2')).toBeTruthy();
  });
});
