import { useState, useEffect, useMemo } from 'react';
import { container } from 'tsyringe';
import '../infrastructure/di/registerServices';
import type { Task } from '../domain/entities/Task';
import type { Project } from '../domain/entities/Project';
import type { SuggestionService, SuggestionResult } from '../infrastructure/ai/suggestionService';
import { FEATURE_AI_SUGGESTIONS } from '../config/featureFlags';

export interface UseTaskDetailReturn {
  suggestion: SuggestionResult | null;
  loadingSuggestion: boolean;
}

/**
 * useTaskDetail — fetches an optional AI suggestion for the currently-open task.
 *
 * - Does nothing when FEATURE_AI_SUGGESTIONS is false (returns null immediately).
 * - Resolves `SuggestionService` from the DI container; defaults silently to no-op
 *   when the token is not registered (e.g. in tests).
 *
 * @param task           The currently-selected task (null = sheet is closed).
 * @param project        The project the task belongs to (for context metadata).
 * @param _overrideSvc   Optional: inject a custom SuggestionService for testing.
 */
export function useTaskDetail(
  task: Task | null,
  project: Project | null,
  _overrideSvc?: SuggestionService,
): UseTaskDetailReturn {
  const [suggestion, setSuggestion] = useState<SuggestionResult | null>(null);
  const [loadingSuggestion, setLoadingSuggestion] = useState(false);

  const suggestionService = useMemo<SuggestionService | null>(() => {
    if (_overrideSvc) return _overrideSvc;
    try {
      return container.resolve<SuggestionService>('SuggestionService');
    } catch {
      return null;
    }
   
  }, [_overrideSvc]);

  useEffect(() => {
    if (!FEATURE_AI_SUGGESTIONS || !task || !suggestionService) {
      setSuggestion(null);
      return;
    }

    let cancelled = false;
    setLoadingSuggestion(true);

    suggestionService
      .getSuggestion({
        taskId: task.id,
        description: task.description,
        photos: task.photos ?? [],
        siteConstraints: task.siteConstraints,
        projectLocation: project?.location,
        fireZone: project?.fireZone,
        regulatoryFlags: project?.regulatoryFlags,
      })
      .then((result) => {
        if (!cancelled) setSuggestion(result);
      })
      .catch((err) => {
        console.error('[useTaskDetail] suggestion fetch failed', err);
        if (!cancelled) setSuggestion(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingSuggestion(false);
      });

    return () => {
      cancelled = true;
    };
  }, [task, suggestionService, project?.id, project?.location, project?.fireZone, project?.regulatoryFlags]);

  return { suggestion, loadingSuggestion };
}
