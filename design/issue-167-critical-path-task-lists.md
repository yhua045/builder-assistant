# Design: Issue #167 — Repository-driven "Critical Path" Task Lists

**Date:** 2026-03-20  
**Author:** Architect  
**Status:** Awaiting approval (LGTM → hand off to `developer` agent)

---

## 0. Codebase Reality Check

> **This is a pure React Native app — there is no HTTP backend.**

The issue text mentions `POST /api/v1/critical-path/suggest`, but the app is a standalone React Native app backed by SQLite via Drizzle ORM and tsyringe DI. There is no Express/NestJS server, no API router, and no network layer for internal business logic.

**Decision:** Implement the "endpoint" as a local `SuggestCriticalPathUseCase` — the same Clean Architecture pattern used throughout the codebase (e.g., `CreateTaskUseCase`, `GetProjectAnalysisUseCase`). The use-case input/output contract mirrors the proposed REST body/response exactly, so LLM augmentation or a real HTTP adapter can be bolted on later without changing the interface.

---

## 1. User Story

> As a builder or owner-builder setting up a project,  
> I want to receive an ordered, jurisdiction-aware list of critical-path tasks for my project type  
> so that I can immediately scaffold a realistic construction plan without starting from scratch.

---

## 2. Domain Concepts

> **Design Rule — High-Level Stages Only:** Every entry in a lookup file represents a single, named construction *stage* (e.g. "DA / CDC Approval", "Slab Pour"). These are the coarse-grained milestones a builder tracks on a whiteboard — **not** granular sub-tasks or checklist items. Sub-task decomposition is a separate concern handled elsewhere in the app and is explicitly out of scope for this feature.

| Term | Definition |
|---|---|
| `CriticalPathTaskTemplate` | A **high-level construction stage** from a lookup file — not yet persisted to the DB. Contains `id`, `title`, `recommended_start_offset_days?`, `critical_flag`, `condition?`, `blocked_by?`, `notes?`. No sub-task arrays; no granular step descriptions. |
| `CriticalPathLookupFile` | A JSON file (one per state × project_type) containing metadata + an ordered `tasks[]` array of high-level stages. |
| `SuggestCriticalPathRequest` | Input DTO: `project_type`, `state?`, `storeys?`, `heritage_flag?`, `constrained_site_flag?`, `connects_to_existing?`, `estimated_value?`, `council?`. |
| `CriticalPathSuggestion` | Output DTO: `CriticalPathTaskTemplate` + `source: 'lookup'`. |
| **Condition evaluation** | Boolean expressions like `"heritage_flag === true"` evaluated safely against the request flags. |
| **Fallback chain** | `NSW/complete_rebuild.json` → `National/complete_rebuild.json` → error. |

---

## 3. Architecture Diagram

```
UI (CriticalPathPreview)
       │  via hook
       ▼
useCriticalPath (hook)
       │  creates & calls
       ▼
SuggestCriticalPathUseCase          ← application layer
       │  delegates to
       ▼
CriticalPathService                 ← application/services (pure logic)
       │  reads from
       ▼
Static JSON lookup files            ← src/data/critical-path/
(bundled via Metro require())
```

**No repository interface needed** — lookup files are static, version-controlled data bundled with the app. No DB persistence is required for suggestion generation. (Persisting accepted tasks to the project plan is handled by the existing `CreateTaskUseCase`.)

---

## 4. File Inventory

### 4a. New files to create

```
src/data/critical-path/
├── schema.ts                                    # TypeScript interfaces + validateLookupFile()
├── README.md                                    # Contributor guide
├── index.ts                                     # Lookup registry (maps state+type → require())
├── National/
│   ├── complete_rebuild.json
│   ├── extension.json
│   └── renovation.json
└── NSW/
    ├── complete_rebuild.json
    └── extension.json

src/application/services/
└── CriticalPathService.ts                       # Selection logic + condition evaluation

src/application/usecases/criticalpath/
└── SuggestCriticalPathUseCase.ts                # Thin orchestrator; calls CriticalPathService

src/hooks/
└── useCriticalPath.ts                           # React hook (loading, error, suggestions state)

src/components/CriticalPathPreview/
├── index.tsx                                    # Export barrel
├── CriticalPathPreview.tsx                      # Main component
└── CriticalPathTaskRow.tsx                      # Single task row (reorder/remove)

__tests__/unit/
├── CriticalPathService.test.ts                  # All selection logic + condition eval
├── SuggestCriticalPathUseCase.test.ts           # Canonical scenarios (complete rebuild, extension)
├── criticalPathSchema.test.ts                   # Schema validation against fixture files
└── CriticalPathPreview.test.tsx                 # UI rendering smoke test
```

### 4b. Modified files

```
src/infrastructure/di/registerServices.ts        # Register CriticalPathService if singleton needed
src/domain/entities/Task.ts                      # Add optional `order?: number` field
src/infrastructure/database/schema.ts            # Add `order` integer column to tasks table
```

> **DB migration required.** The `tasks` table currently has no `order` column (confirmed by inspection of `schema.ts`). Add `order: integer('order')` (nullable, no default) so that tasks created from critical-path suggestions carry their sequence number. Run `npm run db:generate` then `npm run db:push` (dev) or restart the app (production) to apply. The column is nullable so all existing tasks remain unaffected.

> **Note:** `CriticalPathService` is a pure, stateless class. It does not require async I/O or a DB. It can be instantiated directly in the use case or registered as a singleton — decision deferred to implementation.

---

## 5. Interfaces & Types (`src/data/critical-path/schema.ts`)

```typescript
export type ProjectType =
  | 'complete_rebuild'
  | 'extension'
  | 'renovation'
  | 'knockdown_rebuild'
  | 'dual_occupancy';

export type AustralianState =
  | 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'ACT' | 'NT' | 'National';

/**
 * Represents a single high-level construction stage.
 * IMPORTANT: Do NOT add sub-task arrays or granular step lists here.
 * Keep `title` to a short, whiteboard-level label (≤ 60 chars).
 * `notes` may carry a brief regulatory callout (1–2 sentences max).
 */
export interface CriticalPathTaskTemplate {
  id: string;
  /** Short, whiteboard-level stage name. No granular sub-tasks. */
  title: string;
  /**
   * 1-based display sequence assigned by CriticalPathService after condition
   * filtering. Preserved on the created Task record so the Tasks screen can
   * sort pending tasks in logical construction order even before start/due
   * dates are set by the builder.
   */
  order: number;
  recommended_start_offset_days?: number;
  critical_flag: boolean;
  /** Optional: JS boolean expression evaluated against SuggestCriticalPathRequest flags.
   *  e.g. "heritage_flag === true"
   *  Absent = always included. False-evaluating = excluded. */
  condition?: string;
  /** Task IDs that must precede this one (informational; not enforced by service). */
  blocked_by?: string[];
  /** Brief regulatory or jurisdictional note (1–2 sentences). NOT a sub-task list. */
  notes?: string;
}

export interface CriticalPathLookupFile {
  project_type: ProjectType;
  state: AustralianState;
  title: string;
  version: string;           // semver e.g. "1.0.0"
  tasks: CriticalPathTaskTemplate[];
}

// ── Output DTO ──────────────────────────────────────────────────────────────

export interface CriticalPathSuggestion extends CriticalPathTaskTemplate {
  source: 'lookup';
  lookup_file: string;       // e.g. "NSW/complete_rebuild" — for audit logging
}

// ── Request DTO ─────────────────────────────────────────────────────────────

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
```

---

## 6. Lookup File Format (example `NSW/complete_rebuild.json`)

> **Authoring rule:** Each task entry must be a **single, high-level construction stage** — a label a builder would write on a whiteboard. Do **not** add `description` fields enumerating sub-steps; do **not** nest sub-task arrays. A one-sentence `notes` field for regulatory callouts is acceptable.

```jsonc
{
  "project_type": "complete_rebuild",
  "state": "NSW",
  "title": "Complete rebuild (NSW canonical)",
  "version": "1.0.0",
  "tasks": [
    {
      // High-level stage only — NO description sub-steps.
      "id": "nsw-cr-01",
      "title": "DA / CDC Approval",
      "recommended_start_offset_days": 0,
      "critical_flag": true,
      "notes": "NSW: lodged through NSW Planning Portal"
    },
    {
      "id": "nsw-cr-02",
      "title": "Heritage Impact Statement",
      "recommended_start_offset_days": 0,
      "critical_flag": true,
      "condition": "heritage_flag === true",
      "blocked_by": [],
      "notes": "NSW: required when property is heritage listed or within conservation area"
    },
    {
      "id": "nsw-cr-03",
      "title": "Asbestos Survey & Demolition Permit",
      "description": "Commission asbestos survey and obtain demolition permit",
      "recommended_start_offset_days": 5,
      "critical_flag": true
    }
    // ... remaining canonical stages
  ]
}
```

---

## 7. CriticalPathService Design

```typescript
// src/application/services/CriticalPathService.ts

export class CriticalPathService {

  /**
   * Resolves the best-matching lookup file key for the given request.
   * Fallback chain: `<state>/<project_type>` → `National/<project_type>` → throws.
   */
  resolveKey(req: SuggestCriticalPathRequest): string { ... }

  /**
   * Loads the CriticalPathLookupFile for the given key using the lookup registry.
   * Throws CriticalPathLookupNotFoundError if neither state-specific nor national exists.
   */
  loadFile(key: string): CriticalPathLookupFile { ... }

  /**
   * Evaluates a condition expression string against the request flags.
   * Only supports simple boolean flag comparisons:
   *   "heritage_flag === true"
   *   "constrained_site_flag === true"
   *   "connects_to_existing === true"
   * Throws on unrecognised expressions (fail-safe: include the task).
   */
  evaluateCondition(condition: string, req: SuggestCriticalPathRequest): boolean { ... }

  /**
   * Main entry point. Returns filtered, ordered CriticalPathSuggestion[].
   */
  suggest(req: SuggestCriticalPathRequest): CriticalPathSuggestion[] { ... }
}
```

**Condition evaluation**: A whitelist-only approach — the evaluator parses only the patterns `<flag> === true` and `<flag> === false` against a known set of flags. This completely avoids `eval()` and prevents code injection while matching all the required flag expressions.

---

## 8. Use Case Design

```typescript
// src/application/usecases/criticalpath/SuggestCriticalPathUseCase.ts

export class SuggestCriticalPathUseCase {
  constructor(private readonly service: CriticalPathService) {}

  execute(request: SuggestCriticalPathRequest): CriticalPathSuggestion[] {
    // Delegates entirely to service. Thin orchestrator — consistent with codebase.
    return this.service.suggest(request);
  }
}
```

---

## 9. Hook Design (`useCriticalPath`)

```typescript
interface UseCriticalPathReturn {
  suggestions: CriticalPathSuggestion[];
  isLoading: boolean;              // true while resolving the lookup file
  error: string | null;
  suggest: (request: SuggestCriticalPathRequest) => void;

  // ── Selection state (default: ALL suggestions selected) ──────────────────
  /** Set of task IDs the user has chosen to include. Initialised to all suggestion IDs. */
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;   // tick / un-tick a single task
  selectAll: () => void;                   // re-select everything
  clearAll: () => void;                    // deselect everything

  // ── Bulk-creation progress state ─────────────────────────────────────────
  /** True while CreateTaskUseCase calls are in flight. */
  isCreating: boolean;
  /** null until creation starts; { completed, total } while in progress. */
  creationProgress: { completed: number; total: number } | null;
  creationError: string | null;

  /** Creates Task records for every currently-selected suggestion. */
  confirmSelected: (projectId: string) => Promise<void>;
}
```

Default selection behaviour: whenever `suggest()` resolves, `selectedIds` is initialised to the full set of returned suggestion IDs — every checkbox starts ticked. The user opts **out** by unchecking items.

The `confirmSelected` action iterates only the selected suggestions **in their `order` sequence** and calls the existing `CreateTaskUseCase` for each, converting `CriticalPathSuggestion` → `Task` (mapping `recommended_start_offset_days` to `scheduledAt` relative to project `startDate`, and preserving `order` on the created task). After each successful call `creationProgress.completed` is incremented so the UI can render a live counter or progress bar. On completion `isCreating` returns to `false`.

> **Order assignment:** `CriticalPathService.suggest()` assigns a 1-based `order` to each suggestion after condition filtering and array traversal, so the sequence is contiguous (1, 2, 3 …) and matches the logical construction order defined in the lookup file. The Tasks screen can then `ORDER BY order ASC NULLS LAST` to show a sensible pending-task sequence even when `scheduledAt` and `dueDate` are both null.

---

## 10. UI Component (`CriticalPathPreview`)

**MVP scope:**

### 10a. Task list (checkbox opt-out)
- Renders every suggestion as a **checkbox row** (`CriticalPathTaskRow`).
- All checkboxes are **ticked by default** — the user opts *out* by unchecking.
- Each row shows: checkbox, task `title`, `critical_flag` badge, optional `notes` disclosure.
- Tapping the row label or the checkbox calls `toggleSelection(id)`.
- A "Select all" / "Deselect all" toggle link appears above the list.

### 10b. "Add to Plan" CTA
- The CTA label shows the count of selected tasks: **"Add N Tasks to Plan"**.
- Disabled when 0 tasks are selected.
- On press → calls `confirmSelected(projectId)`.

### 10c. Bulk-creation progress UI
- While `isCreating === true`, the CTA is replaced by a **progress indicator**.
- Show a progress bar or counter: **"Creating tasks… 3 / 11"** (driven by `creationProgress`).
- The task list is non-interactive (disabled) while creation is in progress.
- On completion: dismiss the sheet / navigate to the project task list.
- On `creationError`: show an inline error banner with a "Retry" option.

### 10d. Loading / error states
- While `isLoading === true` (lookup resolution): show a skeleton list.
- If `error !== null`: show error message with a "Try again" button.

**Integration point:** Called from `ProjectDetail` page (or a new "Suggest Tasks" button there).

---

## 11. Logging & Audit

`CriticalPathService.suggest()` appends an entry to the app's console and, where the `AuditLogRepository` is available from context, can log which lookup file was resolved and how many tasks were filtered. No user PII is captured — the log contains only `project_type`, `state`, `lookup_file`, `tasks_returned`.

For MVP, `console.log` for observability is sufficient. A future ticket can wire this to `CreateAuditLogEntryUseCase`.

---

## 12. TDD Step Sequence

### Phase 1 — Red: Write failing tests

| Test file | What it asserts |
|---|---|
| `criticalPathSchema.test.ts` | `validateLookupFile(NSW_complete_rebuild)` returns valid; malformed file throws |
| `criticalPathSchema.test.ts` | Task entries have no sub-task arrays or nested step lists (schema rejects them) |
| `CriticalPathService.test.ts` | `resolveKey` returns correct key; fallback to National; unknown combo throws |
| `CriticalPathService.test.ts` | `evaluateCondition("heritage_flag === true", {heritage_flag: true})` → `true` |
| `CriticalPathService.test.ts` | Condition-gated task excluded when flag is `false` |
| `SuggestCriticalPathUseCase.test.ts` | Complete rebuild NSW → returns 13+ tasks in correct order, all ids unique |
| `CriticalPathService.test.ts` | `suggest()` assigns `order` starting at 1; order values are contiguous after condition filtering |
| `CriticalPathService.test.ts` | When `heritage_flag=false`, subsequent tasks are renumbered so `order` remains contiguous |
| `useCriticalPath.test.ts` | `confirmSelected` calls `CreateTaskUseCase` with `order` equal to suggestion's `order` value |
| `SuggestCriticalPathUseCase.test.ts` | Extension National → returns extension canonical sequence |
| `SuggestCriticalPathUseCase.test.ts` | heritage_flag=true adds heritage task to result |
| `useCriticalPath.test.ts` | After `suggest()`, `selectedIds` equals the full set of returned suggestion IDs |
| `useCriticalPath.test.ts` | `toggleSelection(id)` removes an id from `selectedIds`; calling again re-adds it |
| `useCriticalPath.test.ts` | `confirmSelected` calls `CreateTaskUseCase` only for selected ids |
| `useCriticalPath.test.ts` | `creationProgress` increments after each successful `CreateTaskUseCase` call |
| `useCriticalPath.test.ts` | `isCreating` is `true` while calls are in flight and `false` after completion |
| `CriticalPathPreview.test.tsx` | All task rows render with checked checkboxes by default |
| `CriticalPathPreview.test.tsx` | Unchecking a row calls `toggleSelection`; CTA count label decrements |
| `CriticalPathPreview.test.tsx` | CTA is disabled when 0 tasks selected |
| `CriticalPathPreview.test.tsx` | Progress bar/counter renders while `isCreating === true`; list is non-interactive |
| `CriticalPathPreview.test.tsx` | Error banner with "Retry" renders on `creationError` |

### Phase 2 — Green: Implement

Order:
1. `schema.ts` types + `validateLookupFile()`
2. JSON lookup files (National: complete_rebuild, extension; NSW: complete_rebuild, extension)
3. `index.ts` registry
4. `CriticalPathService.ts`
5. `SuggestCriticalPathUseCase.ts`
6. `useCriticalPath.ts` hook
7. `CriticalPathPreview` component
8. Register in `registerServices.ts` (optional singleton)

### Phase 3 — Refactor
- Ensure `evaluateCondition` whitelist is exhaustive and documented
- Confirm no `eval()` / `new Function()` anywhere in the service

---

## 13. Acceptance Criteria Checklist

**Data model — high-level stages only**
- [ ] `src/data/critical-path/National/complete_rebuild.json` covers all 13+ canonical high-level stages; no sub-task arrays or `description` step lists present
- [ ] `src/data/critical-path/NSW/complete_rebuild.json` overrides with NSW-specific notes
- [ ] `src/data/critical-path/schema.ts` exports `CriticalPathLookupFile`, `CriticalPathTaskTemplate`, `SuggestCriticalPathRequest`, `CriticalPathSuggestion`
- [ ] `CriticalPathTaskTemplate` interface has **no** sub-task array field; `validateLookupFile()` rejects any task entry that contains nested step lists
- [ ] `validateLookupFile()` is used in tests and verifies all shipped JSON files are valid

**Order / sequence**
- [ ] `CriticalPathService.suggest()` assigns a 1-based `order` to every returned `CriticalPathSuggestion`; values are contiguous after condition filtering
- [ ] `Task` entity (`src/domain/entities/Task.ts`) has an optional `order?: number` field
- [ ] `tasks` DB table has an `order` integer column (nullable, no default — existing rows unaffected)
- [ ] `confirmSelected` passes `order` when calling `CreateTaskUseCase`, so created tasks carry their sequence number
- [ ] Tasks screen can sort by `order ASC NULLS LAST` to show correct construction sequence before dates are set

**Service & use case**
- [ ] `CriticalPathService` resolves state-specific before falling back to National
- [ ] `CriticalPathService` condition evaluation uses whitelist only (no `eval`)
- [ ] `SuggestCriticalPathUseCase` returns tasks with `source: 'lookup'` and `lookup_file`

**Hook — selection & progress**
- [ ] Hook `useCriticalPath` exposes `suggest`, `selectedIds`, `toggleSelection`, `selectAll`, `clearAll`, `isCreating`, `creationProgress`, `creationError`, `confirmSelected`
- [ ] After `suggest()` resolves, `selectedIds` is initialised to the **full set** of returned suggestion IDs (all selected by default)
- [ ] `toggleSelection(id)` removes/adds an id from `selectedIds`
- [ ] `confirmSelected` creates real `Task` records **only for selected ids** via `CreateTaskUseCase`
- [ ] `creationProgress` increments `completed` after each successful `CreateTaskUseCase` call
- [ ] `isCreating` is `true` while creation calls are in flight

**UI — checkbox opt-out**
- [ ] `CriticalPathPreview` renders every suggestion as a checkbox row, all ticked by default
- [ ] Unchecking a row removes that task from the selection; CTA count label updates
- [ ] CTA reads "Add N Tasks to Plan" and is disabled when 0 tasks are selected
- [ ] "Select all" / "Deselect all" control is present and functional

**UI — bulk-creation progress**
- [ ] While `isCreating === true`, the CTA is replaced by a progress indicator (e.g. "Creating tasks… 3 / 11")
- [ ] Task list is non-interactive while creation is in progress
- [ ] On `creationError`, an inline error banner with a "Retry" action is shown

**Quality**
- [ ] All unit tests pass; no TypeScript errors (`npx tsc --noEmit`)
- [ ] `src/data/critical-path/README.md` explains authoring process, links `schema.ts`, and calls out the no-sub-tasks rule

---

## 14. Out of Scope (This PR)

- LLM augmentation / `source: 'llm'` path (future ticket)
- Drag-to-reorder (removed from scope; the checkbox opt-out model replaces the reorder UX)
- **Sub-task / checklist decomposition** — breaking a high-level stage into granular steps is a separate feature and must NOT be added to the lookup schema in this PR
- Council-specific lookup files (only `state` and `National` in v1)
- Audit log persistence (console log only in MVP)
- `estimated_value`-based filtering (captured in schema but not used in v1 condition logic)
