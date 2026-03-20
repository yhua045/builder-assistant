import type { CriticalPathSuggestion, SuggestCriticalPathRequest } from '../../../data/critical-path/schema';
import { CriticalPathService } from '../../services/CriticalPathService';

/**
 * SuggestCriticalPathUseCase — thin orchestrator.
 *
 * Delegates entirely to CriticalPathService.suggest().
 * Follows the same thin-use-case pattern used throughout the codebase.
 */
export class SuggestCriticalPathUseCase {
  constructor(private readonly service: CriticalPathService) {}

  execute(request: SuggestCriticalPathRequest): CriticalPathSuggestion[] {
    return this.service.suggest(request);
  }
}
