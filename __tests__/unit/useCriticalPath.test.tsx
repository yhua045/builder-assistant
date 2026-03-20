/**
 * Unit tests for useCriticalPath hook
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';

// Mock DI registration to avoid native module resolution during unit tests
jest.mock('../../src/infrastructure/di/registerServices', () => ({}));

import { useCriticalPath, UseCriticalPathOptions } from '../../src/hooks/useCriticalPath';
import { SuggestCriticalPathUseCase } from '../../src/application/usecases/criticalpath/SuggestCriticalPathUseCase';
import { CreateTaskUseCase } from '../../src/application/usecases/task/CreateTaskUseCase';
import type { CriticalPathSuggestion, SuggestCriticalPathRequest } from '../../src/data/critical-path/schema';
import type { TaskRepository } from '../../src/domain/repositories/TaskRepository';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeSuggestion(overrides: Partial<CriticalPathSuggestion> = {}): CriticalPathSuggestion {
  return {
    id: 'cp-01',
    title: 'DA / CDC Approval',
    order: 1,
    critical_flag: true,
    source: 'lookup',
    lookup_file: 'NSW/complete_rebuild',
    ...overrides,
  };
}

function makeSuggestions(count: number): CriticalPathSuggestion[] {
  return Array.from({ length: count }, (_, i) =>
    makeSuggestion({ id: `cp-0${i + 1}`, title: `Stage ${i + 1}`, order: i + 1 })
  );
}

function makeMockTaskRepo(): TaskRepository {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    findByProjectId: jest.fn().mockResolvedValue([]),
    findAdHoc: jest.fn().mockResolvedValue([]),
    findUpcoming: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    delete: jest.fn(),
    addDependency: jest.fn(),
    removeDependency: jest.fn(),
    findDependencies: jest.fn().mockResolvedValue([]),
    findDependents: jest.fn().mockResolvedValue([]),
    addDelayReason: jest.fn(),
    removeDelayReason: jest.fn(),
    findDelayReasons: jest.fn().mockResolvedValue([]),
    deleteDependenciesByTaskId: jest.fn().mockResolvedValue(undefined),
    deleteDelayReasonsByTaskId: jest.fn().mockResolvedValue(undefined),
    findProgressLogs: jest.fn().mockResolvedValue([]),
    addProgressLog: jest.fn(),
    updateProgressLog: jest.fn(),
    deleteProgressLog: jest.fn(),
    findAllDependencies: jest.fn().mockResolvedValue([]),
    resolveDelayReason: jest.fn().mockResolvedValue(undefined),
    summarizeDelayReasons: jest.fn().mockResolvedValue([]),
  };
}

// ── Hook wrapper ──────────────────────────────────────────────────────────────

type HookResult = ReturnType<typeof useCriticalPath>;

interface WrapperProps {
  options: UseCriticalPathOptions;
  onResult: (result: HookResult) => void;
}

function HookWrapper({ options, onResult }: WrapperProps) {
  const result = useCriticalPath(options);
  onResult(result);
  return null;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useCriticalPath', () => {
  it('initial state: no suggestions, not loading, no error', async () => {
    const suggestions = makeSuggestions(3);
    const mockUseCase = {
      execute: jest.fn().mockReturnValue(suggestions),
    } as unknown as SuggestCriticalPathUseCase;
    const repo = makeMockTaskRepo();
    const createTaskUseCase = new CreateTaskUseCase(repo);

    let result!: HookResult;
    await act(async () => {
      renderer.create(
        <HookWrapper
          options={{ suggestUseCase: mockUseCase, createTaskUseCase }}
          onResult={r => { result = r; }}
        />
      );
    });

    expect(result.suggestions).toEqual([]);
    expect(result.isLoading).toBe(false);
    expect(result.error).toBeNull();
    expect(result.selectedIds.size).toBe(0);
  });

  it('after suggest(), selectedIds is initialised to full set of returned suggestion IDs', async () => {
    const suggestions = makeSuggestions(3);
    const mockUseCase = {
      execute: jest.fn().mockReturnValue(suggestions),
    } as unknown as SuggestCriticalPathUseCase;
    const repo = makeMockTaskRepo();
    const createTaskUseCase = new CreateTaskUseCase(repo);

    let result!: HookResult;
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HookWrapper
          options={{ suggestUseCase: mockUseCase, createTaskUseCase }}
          onResult={r => { result = r; }}
        />
      );
    });

    const req: SuggestCriticalPathRequest = { project_type: 'complete_rebuild', state: 'NSW' };

    await act(async () => {
      result.suggest(req);
    });

    expect(result.suggestions).toHaveLength(3);
    expect(result.selectedIds.size).toBe(3);
    suggestions.forEach(s => expect(result.selectedIds.has(s.id)).toBe(true));

    await act(async () => { tree.unmount(); });
  });

  it('toggleSelection removes an id, calling again re-adds it', async () => {
    const suggestions = makeSuggestions(3);
    const mockUseCase = {
      execute: jest.fn().mockReturnValue(suggestions),
    } as unknown as SuggestCriticalPathUseCase;
    const repo = makeMockTaskRepo();
    const createTaskUseCase = new CreateTaskUseCase(repo);

    let result!: HookResult;
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HookWrapper
          options={{ suggestUseCase: mockUseCase, createTaskUseCase }}
          onResult={r => { result = r; }}
        />
      );
    });

    await act(async () => {
      result.suggest({ project_type: 'complete_rebuild' });
    });

    const targetId = suggestions[0].id;

    await act(async () => {
      result.toggleSelection(targetId);
    });

    expect(result.selectedIds.has(targetId)).toBe(false);

    await act(async () => {
      result.toggleSelection(targetId);
    });

    expect(result.selectedIds.has(targetId)).toBe(true);

    await act(async () => { tree.unmount(); });
  });

  it('selectAll re-selects all suggestion IDs', async () => {
    const suggestions = makeSuggestions(3);
    const mockUseCase = {
      execute: jest.fn().mockReturnValue(suggestions),
    } as unknown as SuggestCriticalPathUseCase;
    const repo = makeMockTaskRepo();
    const createTaskUseCase = new CreateTaskUseCase(repo);

    let result!: HookResult;
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HookWrapper
          options={{ suggestUseCase: mockUseCase, createTaskUseCase }}
          onResult={r => { result = r; }}
        />
      );
    });

    await act(async () => {
      result.suggest({ project_type: 'complete_rebuild' });
    });

    await act(async () => {
      result.clearAll();
    });

    expect(result.selectedIds.size).toBe(0);

    await act(async () => {
      result.selectAll();
    });

    expect(result.selectedIds.size).toBe(3);

    await act(async () => { tree.unmount(); });
  });

  it('clearAll deselects everything', async () => {
    const suggestions = makeSuggestions(3);
    const mockUseCase = {
      execute: jest.fn().mockReturnValue(suggestions),
    } as unknown as SuggestCriticalPathUseCase;
    const repo = makeMockTaskRepo();
    const createTaskUseCase = new CreateTaskUseCase(repo);

    let result!: HookResult;
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HookWrapper
          options={{ suggestUseCase: mockUseCase, createTaskUseCase }}
          onResult={r => { result = r; }}
        />
      );
    });

    await act(async () => {
      result.suggest({ project_type: 'complete_rebuild' });
    });

    await act(async () => {
      result.clearAll();
    });

    expect(result.selectedIds.size).toBe(0);

    await act(async () => { tree.unmount(); });
  });

  it('confirmSelected calls CreateTaskUseCase only for selected ids', async () => {
    const suggestions = makeSuggestions(3);
    const mockUseCase = {
      execute: jest.fn().mockReturnValue(suggestions),
    } as unknown as SuggestCriticalPathUseCase;
    const repo = makeMockTaskRepo();
    const createTaskUseCase = new CreateTaskUseCase(repo);

    let result!: HookResult;
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HookWrapper
          options={{ suggestUseCase: mockUseCase, createTaskUseCase }}
          onResult={r => { result = r; }}
        />
      );
    });

    await act(async () => {
      result.suggest({ project_type: 'complete_rebuild' });
    });

    // Deselect one
    await act(async () => {
      result.toggleSelection(suggestions[1].id);
    });

    await act(async () => {
      await result.confirmSelected('project-1');
    });

    // repo.save called twice (for the 2 selected tasks)
    expect(repo.save).toHaveBeenCalledTimes(2);

    await act(async () => { tree.unmount(); });
  });

  it('confirmSelected passes order when calling CreateTaskUseCase', async () => {
    const suggestions = makeSuggestions(2);
    const mockUseCase = {
      execute: jest.fn().mockReturnValue(suggestions),
    } as unknown as SuggestCriticalPathUseCase;
    const repo = makeMockTaskRepo();
    const createTaskUseCase = new CreateTaskUseCase(repo);

    let result!: HookResult;
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HookWrapper
          options={{ suggestUseCase: mockUseCase, createTaskUseCase }}
          onResult={r => { result = r; }}
        />
      );
    });

    await act(async () => {
      result.suggest({ project_type: 'complete_rebuild' });
    });

    await act(async () => {
      await result.confirmSelected('project-1');
    });

    // The save calls should have been made with order set
    const saveCalls = (repo.save as jest.Mock).mock.calls;
    expect(saveCalls[0][0].order).toBe(1);
    expect(saveCalls[1][0].order).toBe(2);

    await act(async () => { tree.unmount(); });
  });

  it('creationProgress increments after each successful CreateTaskUseCase call', async () => {
    const suggestions = makeSuggestions(3);
    const mockUseCase = {
      execute: jest.fn().mockReturnValue(suggestions),
    } as unknown as SuggestCriticalPathUseCase;

    const saveMock = jest.fn().mockResolvedValue(undefined);
    const repo = makeMockTaskRepo();
    (repo.save as jest.Mock).mockImplementation(saveMock);
    const createTaskUseCase = new CreateTaskUseCase(repo);

    let result!: HookResult;
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HookWrapper
          options={{ suggestUseCase: mockUseCase, createTaskUseCase }}
          onResult={r => { result = r; }}
        />
      );
    });

    await act(async () => {
      result.suggest({ project_type: 'complete_rebuild' });
    });

    await act(async () => {
      await result.confirmSelected('project-1');
    });

    expect(result.creationProgress).toEqual({ completed: 3, total: 3 });

    await act(async () => { tree.unmount(); });
  });

  it('isCreating is false after creation completes', async () => {
    const suggestions = makeSuggestions(2);
    const mockUseCase = {
      execute: jest.fn().mockReturnValue(suggestions),
    } as unknown as SuggestCriticalPathUseCase;
    const repo = makeMockTaskRepo();
    const createTaskUseCase = new CreateTaskUseCase(repo);

    let result!: HookResult;
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HookWrapper
          options={{ suggestUseCase: mockUseCase, createTaskUseCase }}
          onResult={r => { result = r; }}
        />
      );
    });

    await act(async () => {
      result.suggest({ project_type: 'complete_rebuild' });
    });

    await act(async () => {
      await result.confirmSelected('project-1');
    });

    expect(result.isCreating).toBe(false);

    await act(async () => { tree.unmount(); });
  });

  it('error state is set when suggest use case throws', async () => {
    const mockUseCase = {
      execute: jest.fn().mockImplementation(() => {
        throw new Error('Lookup file not found');
      }),
    } as unknown as SuggestCriticalPathUseCase;
    const repo = makeMockTaskRepo();
    const createTaskUseCase = new CreateTaskUseCase(repo);

    let result!: HookResult;
    let tree!: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(
        <HookWrapper
          options={{ suggestUseCase: mockUseCase, createTaskUseCase }}
          onResult={r => { result = r; }}
        />
      );
    });

    await act(async () => {
      result.suggest({ project_type: 'complete_rebuild' });
    });

    expect(result.error).not.toBeNull();
    expect(result.suggestions).toEqual([]);

    await act(async () => { tree.unmount(); });
  });
});
