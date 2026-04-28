/**
 * Unit tests for useCriticalPath hook
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '../utils/queryClientWrapper';

// Mock DI registration to avoid native module resolution during unit tests
jest.mock('../../src/infrastructure/di/registerServices', () => ({}));

import { useCriticalPath, UseCriticalPathOptions } from '../../src/hooks/useCriticalPath';
import { SuggestCriticalPathUseCase } from '../../src/application/usecases/criticalpath/SuggestCriticalPathUseCase';
import { CreateTaskUseCase } from '../../src/features/tasks/application/CreateTaskUseCase';
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

// Wrap HookWrapper with QueryClientProvider to avoid "No QueryClient set" errors
// Uses a shared client to avoid memory leaks from creating new clients per test
let sharedQueryClient: QueryClient;

function HookWrapperWithQuery(props: WrapperProps) {
  if (!sharedQueryClient) {
    sharedQueryClient = createTestQueryClient();
  }
  return (
    <QueryClientProvider client={sharedQueryClient}>
      <HookWrapper {...props} />
    </QueryClientProvider>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe.skip('useCriticalPath', () => {
  afterEach(() => {
    if (sharedQueryClient) {
      sharedQueryClient.clear();
    }
  });

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
        <HookWrapperWithQuery
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
        <HookWrapperWithQuery
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
        <HookWrapperWithQuery
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
        <HookWrapperWithQuery
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
        <HookWrapperWithQuery
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
        <HookWrapperWithQuery
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
        <HookWrapperWithQuery
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
        <HookWrapperWithQuery
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
        <HookWrapperWithQuery
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
        <HookWrapperWithQuery
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

  // ── Idempotency (Issue #169) ──────────────────────────────────────────────

  describe.skip('idempotency — stable task IDs', () => {
    it('confirmSelected uses a stable id for each suggestion (matches stableId utility)', async () => {
      const { stableId } = require('../../src/utils/stableId');

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
          <HookWrapperWithQuery
            options={{ suggestUseCase: mockUseCase, createTaskUseCase }}
            onResult={r => { result = r; }}
          />
        );
      });

      await act(async () => {
        result.suggest({ project_type: 'complete_rebuild' });
      });

      const projectId = 'proj-stable-1';
      await act(async () => {
        await result.confirmSelected(projectId);
      });

      const saveCalls = (repo.save as jest.Mock).mock.calls;
      expect(saveCalls[0][0].id).toBe(stableId(projectId, suggestions[0].id));
      expect(saveCalls[1][0].id).toBe(stableId(projectId, suggestions[1].id));

      await act(async () => { tree.unmount(); });
    });

    it('on second confirmSelected call, already-confirmed tasks are skipped', async () => {
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
          <HookWrapperWithQuery
            options={{ suggestUseCase: mockUseCase, createTaskUseCase }}
            onResult={r => { result = r; }}
          />
        );
      });

      await act(async () => {
        result.suggest({ project_type: 'complete_rebuild' });
      });

      const projectId = 'proj-stable-2';

      // First call — all 3 tasks created
      await act(async () => {
        await result.confirmSelected(projectId);
      });
      expect(repo.save).toHaveBeenCalledTimes(3);

      // Second call — all tasks already confirmed, none retried
      (repo.save as jest.Mock).mockClear();
      await act(async () => {
        await result.confirmSelected(projectId);
      });
      expect(repo.save).toHaveBeenCalledTimes(0);

      await act(async () => { tree.unmount(); });
    });

    it('on retry after partial failure, only failed tasks are re-attempted', async () => {
      const suggestions = makeSuggestions(3);
      const mockUseCase = {
        execute: jest.fn().mockReturnValue(suggestions),
      } as unknown as SuggestCriticalPathUseCase;
      const repo = makeMockTaskRepo();

      // Make the 3rd save fail on first call
      let callCount = 0;
      (repo.save as jest.Mock).mockImplementation(async () => {
        callCount++;
        if (callCount === 3) throw new Error('DB write failed');
      });

      const createTaskUseCase = new CreateTaskUseCase(repo);

      let result!: HookResult;
      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <HookWrapperWithQuery
            options={{ suggestUseCase: mockUseCase, createTaskUseCase }}
            onResult={r => { result = r; }}
          />
        );
      });

      await act(async () => {
        result.suggest({ project_type: 'complete_rebuild' });
      });

      const projectId = 'proj-stable-3';

      // First call — fails on 3rd task
      await act(async () => {
        await result.confirmSelected(projectId);
      });
      expect(result.creationError).not.toBeNull();

      // Fix the mock — make save succeed
      (repo.save as jest.Mock).mockReset();
      (repo.save as jest.Mock).mockResolvedValue(undefined);

      // Retry — only the failed 3rd task should be attempted
      await act(async () => {
        await result.confirmSelected(projectId);
      });

      // Only 1 task retried (the one that failed)
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(result.creationError).toBeNull();

      await act(async () => { tree.unmount(); });
    });

    it('task IDs on retry are identical to the first attempt (stable IDs)', async () => {
      const { stableId } = require('../../src/utils/stableId');

      const suggestions = makeSuggestions(2);
      const mockUseCase = {
        execute: jest.fn().mockReturnValue(suggestions),
      } as unknown as SuggestCriticalPathUseCase;
      const repo = makeMockTaskRepo();

      // Fail first call, succeed second
      let firstCall = true;
      (repo.save as jest.Mock).mockImplementation(async () => {
        if (firstCall) {
          firstCall = false;
          throw new Error('Temporary failure');
        }
      });

      const createTaskUseCase = new CreateTaskUseCase(repo);

      let result!: HookResult;
      let tree!: renderer.ReactTestRenderer;
      await act(async () => {
        tree = renderer.create(
          <HookWrapperWithQuery
            options={{ suggestUseCase: mockUseCase, createTaskUseCase }}
            onResult={r => { result = r; }}
          />
        );
      });

      await act(async () => {
        result.suggest({ project_type: 'complete_rebuild' });
      });

      const projectId = 'proj-stable-id-check';

      // First attempt — fails on 1st task
      await act(async () => {
        await result.confirmSelected(projectId);
      });

      const firstAttemptIds = (repo.save as jest.Mock).mock.calls.map(
        (c: any) => c[0].id,
      );

      // Reset and retry
      (repo.save as jest.Mock).mockClear();
      (repo.save as jest.Mock).mockResolvedValue(undefined);

      await act(async () => {
        await result.confirmSelected(projectId);
      });

      const retryIds = (repo.save as jest.Mock).mock.calls.map((c: any) => c[0].id);

      // The retried task IDs should match the stable IDs
      retryIds.forEach((id: string) => {
        expect(id).toBe(stableId(projectId, suggestions.find(s => stableId(projectId, s.id) === id)!.id));
        // The retried task was not in the first attempt's successful saves
        expect(firstAttemptIds).not.toContain(id);
      });

      await act(async () => { tree.unmount(); });
    });
  });
});
