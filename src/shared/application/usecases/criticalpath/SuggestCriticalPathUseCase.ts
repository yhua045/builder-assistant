import type { CriticalPathSuggestion, SuggestCriticalPathRequest } from '../../../../shared/data/critical-path/schema';
import { CriticalPathService } from '../../services/CriticalPathService';

export class SuggestCriticalPathUseCase {
  constructor(private readonly service: CriticalPathService) {}

  execute(request: SuggestCriticalPathRequest): CriticalPathSuggestion[] {
    return this.service.suggest(request);
  }
}
