import renderer, { act } from 'react-test-renderer';
import React, { useEffect } from 'react';
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

    let latest: any = null;

    function TestHarness() {
      const state = useProjects();
      useEffect(() => {
        latest = state;
      }, [state]);
      return null;
    }

    await act(async () => {
      renderer.create(<TestHarness />);
      for (let i = 0; i < 20; i++) {
        if (latest && latest.loading === false) break;
        await new Promise<void>(resolve => setTimeout(resolve, 50));
      }
    });

    expect(latest.loading).toBe(false);
    expect(latest.error).toBeNull();
    expect(latest.projects).toHaveLength(1);
    expect(mockRepo.list).toHaveBeenCalledTimes(1);
  });

  it('sets error when initial load fails', async () => {
    mockRepo.list.mockRejectedValueOnce(new Error('DB error'));

    let latest: any = null;

    function TestHarness() {
      const state = useProjects();
      useEffect(() => {
        latest = state;
      }, [state]);
      return null;
    }

    await act(async () => {
      renderer.create(<TestHarness />);
      for (let i = 0; i < 20; i++) {
        if (latest && latest.loading === false) break;
        await new Promise<void>(resolve => setTimeout(resolve, 50));
      }
    });

    expect(latest.loading).toBe(false);
    expect(latest.projects).toHaveLength(0);
    expect(latest.error).toContain('DB error');
  });

  it('createProject refreshes list on success', async () => {
    // Sequence: initial load -> refresh list
    // (no uniqueness check because request has no address/projectOwner)
    mockRepo.list
      .mockResolvedValueOnce({ items: [], meta: {} }) // initial
      .mockResolvedValue({ items: [{ id: 'p2', name: 'New', materials: [], phases: [], status: 'planning' }], meta: {} }); // refreshed and any subsequent

    mockRepo.save.mockResolvedValueOnce(undefined);

    let latest: any = null;

    function TestHarness() {
      const state = useProjects();
      useEffect(() => {
        latest = state;
      }, [state]);
      return null;
    }

    await act(async () => {
      renderer.create(<TestHarness />);
      for (let i = 0; i < 20; i++) {
        if (latest && latest.loading === false) break;
        await new Promise<void>(resolve => setTimeout(resolve, 50));
      }
    });

    await act(async () => {
      const res = await latest.createProject({
        name: 'New',
        description: 'desc',
        budget: 1000,
        startDate: new Date(),
        expectedEndDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 40),
      } as any);
      expect(res.success).toBe(true);
      
      // Wait for state to update after refresh
      for (let i = 0; i < 20; i++) {
        if (latest.projects.find((p: any) => p.id === 'p2')) break;
        await new Promise<void>(resolve => setTimeout(resolve, 50));
      }
    });

    // After createProject completes, refresh should have run
    expect(mockRepo.save).toHaveBeenCalledTimes(1);
    expect(mockRepo.list.mock.calls.length).toBeGreaterThanOrEqual(2); // initial + refresh
    expect(latest.projects.find((p: any) => p.id === 'p2')).toBeTruthy();
  });
});
