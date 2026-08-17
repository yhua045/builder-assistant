/**
 * CriticalPathService — pure, stateless service.
 *
 * Responsibilities:
 * - Resolve the best-matching lookup file key for a request (state-specific → National fallback).
 * - Load the lookup file from the static registry.
 * - Evaluate `condition` expressions against request flags using a whitelist-only parser
 *   (NO eval() / new Function() — immune to code injection).
 * - Return a filtered, 1-based ordered list of CriticalPathSuggestion objects.
 */

import type {
  CriticalPathLookupFile,
  CriticalPathSuggestion,
  CriticalPathTaskTemplate,
  SuggestCriticalPathRequest,
} from '../../data/critical-path/schema';
import { getLookupFile } from '../../data/critical-path/index';

// ── Error ─────────────────────────────────────────────────────────────────────

export class CriticalPathLookupNotFoundError extends Error {
  constructor(public readonly requestedKey: string) {
    super(`No critical-path lookup file found for key: "${requestedKey}"`);
    this.name = 'CriticalPathLookupNotFoundError';
  }
}

// ── Whitelist for condition evaluation ───────────────────────────────────────

/**
 * The set of flag names that may appear in condition expressions.
 * Adding a new flag here automatically enables it in evaluateCondition.
 */
const ALLOWED_FLAGS: ReadonlyArray<keyof SuggestCriticalPathRequest> = [
  'heritage_flag',
  'constrained_site_flag',
  'connects_to_existing',
];

/**
 * Pattern: `<flag> === true` or `<flag> === false`
 *
 * The regex anchors on exact start/end to prevent partial matches.
 * Only ALLOWED_FLAGS are checked — any expression that doesn't match
 * the pattern is treated as fail-open (include the task).
 */
const CONDITION_PATTERN = /^(\w+)\s*===\s*(true|false)$/;

// ── Service ───────────────────────────────────────────────────────────────────

export class CriticalPathService {
  /**
   * Resolves the best-matching lookup file key.
   * Fallback chain: `<state>/<project_type>` → `National/<project_type>`.
   */
  resolveKey(req: SuggestCriticalPathRequest): string {
    if (!req.state || req.state === 'National') {
      return `National/${req.project_type}`;
    }
    return `${req.state}/${req.project_type}`;
  }

  /**
   * Loads the lookup file for the given key.
   * Throws CriticalPathLookupNotFoundError if not found.
   */
  loadFile(key: string): CriticalPathLookupFile {
    const file = getLookupFile(key);
    if (!file) {
      throw new CriticalPathLookupNotFoundError(key);
    }
    return file;
  }

  /**
   * Evaluates a `condition` expression string against the request flags.
   *
   * SECURITY NOTE: This method uses a whitelist-only approach.
   * It parses only the patterns `<flag> === true` and `<flag> === false`
   * against a known set of allowed flag names. No eval() or new Function()
   * is used — arbitrary JS cannot be executed through this method.
   *
   * Fail-safe: any unrecognised expression returns `true` (include the task).
   */
  evaluateCondition(condition: string, req: SuggestCriticalPathRequest): boolean {
    const match = condition.trim().match(CONDITION_PATTERN);
    if (!match) {
      // Unrecognised pattern — fail-open (include task)
      return true;
    }

    const [, flagName, expectedStr] = match;
    const expectedValue = expectedStr === 'true';

    // Only evaluate recognised, allowed flag names
    if (!(ALLOWED_FLAGS as string[]).includes(flagName)) {
      // Unknown flag — fail-open (include task)
      return true;
    }

    const actualValue = Boolean(req[flagName as keyof SuggestCriticalPathRequest]);
    return actualValue === expectedValue;
  }

  /**
   * Main entry point.
   * Returns filtered, 1-based ordered CriticalPathSuggestion[].
   *
   * Order:
   * 1. Resolve the best matching key (state-specific → National fallback).
   * 2. Load the lookup file.
   * 3. Filter tasks whose `condition` evaluates to false against the request.
   * 4. Re-assign contiguous 1-based `order` values to the filtered list.
   * 5. Return suggestions with `source: 'lookup'` and `lookup_file` populated.
   */
  suggest(req: SuggestCriticalPathRequest): CriticalPathSuggestion[] {
    const resolvedKey = this._resolveWithFallback(req);

    const file = this.loadFile(resolvedKey);

    const filtered = file.tasks.filter((task: CriticalPathTaskTemplate) => {
      if (!task.condition) {
        return true;
      }
      return this.evaluateCondition(task.condition, req);
    });

    return filtered.map(
      (task: CriticalPathTaskTemplate, index: number): CriticalPathSuggestion => ({
        ...task,
        order: index + 1,
        source: 'lookup',
        lookup_file: resolvedKey,
      }),
    );
  }

  /**
   * Resolves the key with a National fallback.
   * Returns the resolved key string (state-specific or National).
   * Throws CriticalPathLookupNotFoundError if neither exists.
   */
  private _resolveWithFallback(req: SuggestCriticalPathRequest): string {
    const primaryKey = this.resolveKey(req);

    // Try primary key
    if (getLookupFile(primaryKey)) {
      return primaryKey;
    }

    // Fallback to National
    const nationalKey = `National/${req.project_type}`;
    if (nationalKey !== primaryKey && getLookupFile(nationalKey)) {
      return nationalKey;
    }

    // Nothing found — throw with the primary key for a clear error message
    throw new CriticalPathLookupNotFoundError(primaryKey);
  }
}
