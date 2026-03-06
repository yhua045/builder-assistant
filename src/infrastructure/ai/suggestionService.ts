/**
 * SuggestionService — AI-assisted issue context for blocked tasks.
 *
 * Architecture
 * ────────────
 * SuggestionService is the port (interface) consumed by `useTaskDetail`.
 * StubSuggestionService is the default implementation — it always returns null
 * so the UI suggestion panel stays hidden until a real LLM adapter is wired in.
 *
 * To add a real LLM backend:
 *   1. Create `OpenAISuggestionService implements SuggestionService` inside this folder.
 *   2. Register it as 'SuggestionService' in `src/infrastructure/di/registerServices.ts`.
 *
 * Context fields collected per the issue design:
 *   task.description, task.photos, task.siteConstraints
 *   project.location, project.fireZone, project.regulatoryFlags
 */

// ─── Context ──────────────────────────────────────────────────────────────────

export interface SuggestionContext {
  taskId: string;
  description?: string;
  /** URIs of photos attached to the task (file:// or https://) */
  photos: string[];
  /** Free-text site constraint note, e.g. "No heavy vehicles before 9am" */
  siteConstraints?: string;
  /** Street address or lat/lng string */
  projectLocation?: string;
  /** BAL rating or bushfire zone code, e.g. "BAL-29" */
  fireZone?: string;
  /** Arbitrary regulatory constraint labels */
  regulatoryFlags?: string[];
}

// ─── Result ───────────────────────────────────────────────────────────────────

export interface SuggestionResult {
  /** Short, non-authoritative suggestion text */
  suggestion: string;
  confidence: 'low' | 'medium' | 'high';
  /**
   * Disclaimer shown alongside the suggestion — always non-empty.
   * Callers MUST render this text adjacent to the suggestion.
   */
  disclaimer: string;
}

// ─── Port (interface) ─────────────────────────────────────────────────────────

export interface SuggestionService {
  /**
   * Returns a suggestion for the given task context, or `null` when the
   * service is unable / unconfigured.  The UI should handle both cases
   * gracefully (null → do not render the suggestion panel).
   */
  getSuggestion(ctx: SuggestionContext): Promise<SuggestionResult | null>;
}

// ─── Default implementation ───────────────────────────────────────────────────

/**
 * StubSuggestionService — used when FEATURE_AI_SUGGESTIONS is false or
 * when no real LLM adapter is registered in the DI container.
 *
 * Always returns null → UI suggestion panel is not rendered.
 */
export class StubSuggestionService implements SuggestionService {
  getSuggestion(_ctx: SuggestionContext): Promise<SuggestionResult | null> {
    return Promise.resolve(null);
  }
}
