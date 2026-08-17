/**
 * Type definitions for critical-path lookup files.
 *
 * AUTHORING RULES:
 * - Each `tasks[]` entry must be a single, named high-level construction STAGE.
 *   Think "whiteboard milestone" — not a granular sub-task or checklist item.
 * - `title` must be ≤ 60 characters.
 * - Do NOT add `steps`, `subtasks`, `checklist`, or any nested step arrays.
 * - `notes` may carry a brief regulatory callout (1–2 sentences max).
 * - `condition` must match one of the supported flag expressions (see evaluateCondition).
 *
 * See README.md for the full contributor guide.
 */

export type ProjectType =
  | 'complete_rebuild'
  | 'extension'
  | 'renovation'
  | 'knockdown_rebuild'
  | 'dual_occupancy';

export type AustralianState =
  | 'NSW'
  | 'VIC'
  | 'QLD'
  | 'WA'
  | 'SA'
  | 'TAS'
  | 'ACT'
  | 'NT'
  | 'National';

/**
 * Represents a single high-level construction stage template.
 * IMPORTANT: Do NOT add sub-task arrays or granular step lists here.
 */
export interface CriticalPathTaskTemplate {
  id: string;
  /** Short, whiteboard-level stage name. No granular sub-tasks. Max 60 chars. */
  title: string;
  /**
   * 1-based display sequence assigned by CriticalPathService after condition
   * filtering. Preserved on the created Task record so the Tasks screen can
   * sort tasks in logical construction order.
   */
  order: number;
  recommended_start_offset_days?: number;
  critical_flag: boolean;
  /**
   * Optional JS boolean expression evaluated against SuggestCriticalPathRequest flags.
   * Supported: "heritage_flag === true", "constrained_site_flag === true",
   *            "connects_to_existing === true", and the `=== false` variants.
   * Absent = always included.
   */
  condition?: string;
  /** Task IDs that must precede this one (informational only). */
  blocked_by?: string[];
  /** Brief regulatory or jurisdictional note (1–2 sentences). NOT a sub-task list. */
  notes?: string;
}

export interface CriticalPathLookupFile {
  project_type: ProjectType;
  state: AustralianState;
  title: string;
  version: string; // semver e.g. "1.0.0"
  tasks: CriticalPathTaskTemplate[];
}

// ── Output DTO ───────────────────────────────────────────────────────────────

export interface CriticalPathSuggestion extends CriticalPathTaskTemplate {
  source: 'lookup';
  /** e.g. "NSW/complete_rebuild" — for audit logging */
  lookup_file: string;
}

// ── Request DTO ──────────────────────────────────────────────────────────────

export interface SuggestCriticalPathRequest {
  project_type: ProjectType;
  state?: AustralianState;
  storeys?: number;
  heritage_flag?: boolean;
  constrained_site_flag?: boolean;
  connects_to_existing?: boolean;
  estimated_value?: number;
  council?: string;
}

// ── Validation ───────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Forbidden field names that indicate sub-task nesting. */
const FORBIDDEN_NESTED_FIELDS = ['steps', 'subtasks', 'checklist', 'subTasks'];

/**
 * Validates a CriticalPathLookupFile object.
 * Returns { valid: true, errors: [] } on success or { valid: false, errors: [...] } on failure.
 *
 * Deliberately does NOT accept sub-task arrays — the schema rejects them explicitly.
 */
export function validateLookupFile(file: unknown): ValidationResult {
  const errors: string[] = [];

  if (!file || typeof file !== 'object') {
    return { valid: false, errors: ['File must be a non-null object'] };
  }

  const f = file as Record<string, unknown>;

  if (!f.project_type) {
    errors.push('Missing required field: project_type');
  }

  if (!f.state) {
    errors.push('Missing required field: state');
  }

  if (!f.title) {
    errors.push('Missing required field: title');
  }

  if (!f.version) {
    errors.push('Missing required field: version');
  }

  if (!Array.isArray(f.tasks)) {
    errors.push('Missing required field: tasks (must be an array)');
  } else if ((f.tasks as unknown[]).length === 0) {
    errors.push('tasks array must not be empty');
  } else {
    (f.tasks as unknown[]).forEach((task, index) => {
      if (!task || typeof task !== 'object') {
        errors.push(`tasks[${index}] must be an object`);
        return;
      }

      const t = task as Record<string, unknown>;

      if (!t.id) {
        errors.push(`tasks[${index}] missing required field: id`);
      }

      if (!t.title) {
        errors.push(`tasks[${index}] missing required field: title`);
      } else if (typeof t.title === 'string' && t.title.length > 60) {
        errors.push(`tasks[${index}] title exceeds 60 characters: "${t.title.slice(0, 20)}..."`);
      }

      // Reject any forbidden nested sub-task arrays
      for (const forbidden of FORBIDDEN_NESTED_FIELDS) {
        if (forbidden in t) {
          errors.push(
            `tasks[${index}] contains forbidden sub-task/nested steps field: "${forbidden}". ` +
            'This schema does not support sub-task decomposition. Remove the field.',
          );
        }
      }
    });
  }

  return { valid: errors.length === 0, errors };
}
