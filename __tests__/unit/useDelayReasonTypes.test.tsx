import renderer, { act } from 'react-test-renderer';
import React, { useEffect } from 'react';
import { container } from 'tsyringe';
import { useDelayReasonTypes } from '../../src/hooks/useDelayReasonTypes';
import { DelayReasonType } from '../../src/domain/entities/DelayReason';

const seededTypes: DelayReasonType[] = [
  { id: 'WEATHER', label: 'Bad weather', displayOrder: 1, isActive: true },
  { id: 'MATERIAL_DELAY', label: 'Material / supply delay', displayOrder: 2, isActive: true },
  { id: 'OTHER', label: 'Other', displayOrder: 10, isActive: true },
];

describe('useDelayReasonTypes hook', () => {
  const mockRepo = {
    findAll: jest.fn(),
    findById: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(container, 'resolve').mockReturnValue(mockRepo);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads delay reason types on mount', async () => {
    mockRepo.findAll.mockResolvedValueOnce(seededTypes);

    let latest: any = null;

    function TestHarness() {
      const state = useDelayReasonTypes();
      useEffect(() => { latest = state; }, [state]);
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
    expect(latest.delayReasonTypes).toHaveLength(3);
    expect(latest.delayReasonTypes[0].id).toBe('WEATHER');
    expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
  });

  it('returns empty array and loading=false when repository throws', async () => {
    mockRepo.findAll.mockRejectedValueOnce(new Error('DB error'));

    let latest: any = null;

    function TestHarness() {
      const state = useDelayReasonTypes();
      useEffect(() => { latest = state; }, [state]);
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
    expect(latest.delayReasonTypes).toEqual([]);
  });

  it('refresh() re-fetches types from the repository', async () => {
    mockRepo.findAll.mockResolvedValue(seededTypes);

    let latest: any = null;

    function TestHarness() {
      const state = useDelayReasonTypes();
      useEffect(() => { latest = state; }, [state]);
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
      await latest.refresh();
    });

    expect(mockRepo.findAll).toHaveBeenCalledTimes(2);
  });
});
