/**
 * useCriticalPath — custom hook for the Critical Path suggestions feature.
 *
 * Manages:
 * - Suggestion loading and error states
 * - Checkbox selection state (default: all selected)
 * - Bulk-creation progress (calls CreateTaskUseCase for each selected suggestion)
 */

import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CriticalPathSuggestion, SuggestCriticalPathRequest } from '../data/critical-path/schema';
import type { SuggestCriticalPathUseCase } from '../application/usecases/criticalpath/SuggestCriticalPathUseCase';
import type { CreateTaskUseCase } from '../application/usecases/task/CreateTaskUseCase';
import { stableId } from '../utils/stableId';
import { invalidations } from './queryKeys';

// ── Public interface ──────────────────────────────────────────────────────────

export interface UseCriticalPathOptions {
  suggestUseCase: SuggestCriticalPathUseCase;
  createTaskUseCase: CreateTaskUseCase;
}

export interface UseCriticalPathReturn {
  suggestions: CriticalPathSuggestion[];
  isLoading: boolean;
  error: string | null;
  suggest: (request: SuggestCriticalPathRequest) => void;

  // ── Selection state (default: ALL suggestions selected) ──────────────────
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  clearAll: () => void;

  // ── Bulk-creation progress ─────────────────────────────────────────────────
  isCreating: boolean;
  creationProgress: { completed: number; total: number } | null;
  creationError: string | null;
  confirmSelected: (projectId: string) => Promise<boolean>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCriticalPath(options: UseCriticalPathOptions): UseCriticalPathReturn {
  const { suggestUseCase, createTaskUseCase } = options;
  const queryClient = useQueryClient();

  const [suggestions, setSuggestions] = useState<CriticalPathSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Bulk-creation progress
  const [isCreating, setIsCreating] = useState(false);
  const [creationProgress, setCreationProgress] = useState<{ completed: number; total: number } | null>(null);
  const [creationError, setCreationError] = useState<string | null>(null);

  // Idempotency tracking (refs — no re-render needed)
  // Suggestion IDs that were successfully saved — skipped on retry.
  const confirmedIdsRef = useRef<Set<string>>(new Set());
  // Suggestion IDs whose save was called (attempted) on the LAST confirmSelected
  // call. On retry the same suggestion's stable ID will be used, so we only
  // skip tasks in `confirmedIdsRef`, NOT those that previously failed.
  const failedIdsRef = useRef<Set<string>>(new Set());

  // ── suggest ───────────────────────────────────────────────────────────────

  const suggest = useCallback(
    (request: SuggestCriticalPathRequest): void => {
      setIsLoading(true);
      setError(null);
      setSuggestions([]);
      setSelectedIds(new Set());
      // Reset idempotency tracking for a fresh suggestion set
      confirmedIdsRef.current = new Set();
      failedIdsRef.current = new Set();

      try {
        const result = suggestUseCase.execute(request);
        setSuggestions(result);
        // Default: ALL suggestions selected
        setSelectedIds(new Set(result.map(s => s.id)));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load suggestions');
      } finally {
        setIsLoading(false);
      }
    },
    [suggestUseCase],
  );

  // ── selection ─────────────────────────────────────────────────────────────

  const toggleSelection = useCallback((id: string): void => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((): void => {
    setSelectedIds(new Set(suggestions.map(s => s.id)));
  }, [suggestions]);

  const clearAll = useCallback((): void => {
    setSelectedIds(new Set());
  }, []);

  // ── confirmSelected ───────────────────────────────────────────────────────

  const confirmSelected = useCallback(
    async (projectId: string): Promise<boolean> => {
      const toCreate = suggestions
        .filter(s => selectedIds.has(s.id))
        .sort((a, b) => a.order - b.order);

      if (toCreate.length === 0) return false;

      setIsCreating(true);
      setCreationError(null);
      setCreationProgress({ completed: 0, total: toCreate.length });

      try {
        let completedCount = 0;
        for (let i = 0; i < toCreate.length; i++) {
          const suggestion = toCreate[i];
          if (confirmedIdsRef.current.has(suggestion.id)) {
            completedCount++;
            setCreationProgress({ completed: completedCount, total: toCreate.length });
            continue;
          }

          try {
            const id = stableId(projectId, suggestion.id);
            await createTaskUseCase.execute({
              id,
              projectId,
              title: suggestion.title,
              status: 'pending',
              order: suggestion.order,
              isCriticalPath: suggestion.critical_flag,
              notes: suggestion.notes,
            });
            confirmedIdsRef.current.add(suggestion.id);
            failedIdsRef.current.delete(suggestion.id);
            completedCount++;
            setCreationProgress({ completed: completedCount, total: toCreate.length });
          } catch (createErr) {
            failedIdsRef.current.add(suggestion.id);
            throw createErr; // Stop bulk creation and surface it
          }
        }
        // Invalidate task list + projects overview so any consumer renders fresh data
        await Promise.all(
          invalidations.tasksCreated({ projectId }).map(key =>
            queryClient.invalidateQueries({ queryKey: key }),
          ),
        );
        return true;
      } catch (err) {
        setCreationError(err instanceof Error ? err.message : 'Failed to create tasks');
        return false;
      } finally {
        setIsCreating(false);
      }
    },
    [suggestions, selectedIds, createTaskUseCase, queryClient],
  );

  return {
    suggestions,
    isLoading,
    error,
    suggest,
    selectedIds,
    toggleSelection,
    selectAll,
    clearAll,
    isCreating,
    creationProgress,
    creationError,
    confirmSelected,
  };
}
