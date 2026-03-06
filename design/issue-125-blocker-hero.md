# Design: Issue #125 — Blocker Hero, Bottom Sheet Reorder & AI Suggestions

**Branch:** `issue-125-blocker-hero`
**Issue:** https://github.com/yhua045/builder-assistant/issues/125
**Date:** 2026-03-06
**Status:** IMPLEMENTED ✅

---

## 1. User Story

> As a builder on site, I need blockers to be the first thing I see when I open the Tasks screen,
> and I need the task detail sheet to surface the most actionable information (what's waiting,
> the task description, quick actions) before burying me in status dropdowns.
> When a task is blocked, an optional AI hint should help me diagnose the root cause faster.

---

## 2. Scope

### Included
- Remove pending/in-progress numeric summary cards from Task Index header.
- Promote `BlockerCarousel` to hero position (top, larger visual weight, higher contrast).
- Reorder `TaskBottomSheet` sections: Next-In-Line → Description → Quick Actions → Status/Priority.
- Add `photos` display/tappable area to Bottom Sheet (showing task photos; upload flow navigates to full details).
- Add optional AI-assisted suggestion area in Bottom Sheet, behind a feature flag.
- New `SuggestionService` adapter in `src/infrastructure/ai/`.
- Minor schema additions to `Task` and `Project` to carry context fields.
- Unit tests for Bottom Sheet ordering logic and the `SuggestionService` adapter.

### Not Included
- Full lightbox/gallery component (navigate to `TaskDetails` for now; tracked separately).
- Subcontractor "Call" quick action wiring (phone dialler integration is a future ticket).
- AI backend/LLM infrastructure provisioning (adapter mocks with a stub; real LLM call is behind the flag).
- Regex/bulk-edit of existing records to populate new context fields.

---

## 3. Acceptance Criteria

- [x] Task Index no longer shows pending / in-progress count cards in the header.
- [x] `BlockerCarousel` renders at the very top of the scrollable body, before the Focus List.
- [x] Winning-state card is also displayed at top (same hero position).
- [x] Bottom Sheet section order (top to bottom): drag handle → title + close → **Next-In-Line** → **Description** → **Quick Actions** → *Prerequisites* → **Status pills** → **Priority pills**.
- [x] Photo thumbnails render in Bottom Sheet when `task.photos` is non-empty; tapping one opens `TaskDetails`.
- [x] AI suggestion area is only rendered when `FEATURE_AI_SUGGESTIONS=true` (env / config flag).
- [x] AI suggestion shows disclaimer text and is non-authoritative in tone.
- [x] `SuggestionService.getSuggestion()` is unit-tested with a mock (happy path + empty-result path).
- [x] TypeScript strict-mode passes (`npx tsc --noEmit`) with no new errors.
- [x] Existing unit/integration tests continue to pass.

---

## 4. Architecture & Component Map

```
src/
├── pages/tasks/index.tsx               ← CHANGE: remove summary cards, BlockerCarousel moves up
├── components/tasks/
│   ├── BlockerCarousel.tsx             ← CHANGE: hero visual style (larger font, red bg strip)
│   └── TaskBottomSheet.tsx             ← CHANGE: section reorder + photos + AI suggestion area
├── hooks/
│   ├── useCockpitData.ts               ← NO CHANGE (data model already correct)
│   └── useTaskDetail.ts                ← NEW: thin hook wrapping SuggestionService call
├── infrastructure/ai/
│   └── suggestionService.ts            ← NEW: AI adapter (feature-flagged, stub by default)
├── domain/entities/
│   ├── Task.ts                         ← CHANGE: add photos?, siteConstraints?
│   └── Project.ts                      ← CHANGE: add location?, regulatoryFlags?, fireZone?
└── infrastructure/database/
    └── schema.ts                       ← CHANGE: new columns (JSON-serialised where needed)
```

---

## 5. Domain Model Changes

### 5.1 `Task` entity additions

```typescript
export interface Task {
  // ... existing fields ...

  /** URIs of photos attached to this task (stored as JSON in SQLite). */
  photos?: string[];

  /**
   * Free-text site constraint note visible to the AI suggestion engine.
   * e.g. "Access via rear lane only — no heavy vehicles before 9am"
   */
  siteConstraints?: string;
}
```

### 5.2 `Project` entity additions

```typescript
export interface Project {
  // ... existing fields ...

  /** Street address or lat/lng string for site location. */
  location?: string;

  /** Comma-separated regulatory flag codes, e.g. "BAL-29,BAL-FZ" (bushfire). */
  fireZone?: string;

  /** Arbitrary array of regulatory constraint labels. */
  regulatoryFlags?: string[];
}
```

### 5.3 Database schema changes (`schema.ts`)

Two SQL columns added to existing tables:

| Table    | Column              | Type    | Notes                          |
|----------|---------------------|---------|--------------------------------|
| `tasks`  | `photos`            | `TEXT`  | JSON array of URI strings      |
| `tasks`  | `site_constraints`  | `TEXT`  | nullable free-text             |
| `projects` | `location`        | `TEXT`  | nullable                       |
| `projects` | `fire_zone`       | `TEXT`  | nullable                       |
| `projects` | `regulatory_flags` | `TEXT` | JSON array                    |

Migration: run `npm run db:generate` after schema edit, restart app to auto-apply.

---

## 6. New File: `src/infrastructure/ai/suggestionService.ts`

```typescript
export interface SuggestionContext {
  taskId: string;
  description?: string;
  photos: string[];          // URIs
  siteConstraints?: string;
  projectLocation?: string;
  fireZone?: string;
  regulatoryFlags?: string[];
}

export interface SuggestionResult {
  suggestion: string;        // Short, non-authoritative text
  confidence: 'low' | 'medium' | 'high';
  disclaimer: string;        // Always shown alongside the suggestion
}

export interface SuggestionService {
  getSuggestion(ctx: SuggestionContext): Promise<SuggestionResult | null>;
}

/**
 * StubSuggestionService — default implementation used when the feature flag
 * is disabled OR when no real LLM endpoint is configured.
 *
 * Returns null so the UI simply does not render the suggestion area.
 */
export class StubSuggestionService implements SuggestionService {
  getSuggestion(_ctx: SuggestionContext): Promise<SuggestionResult | null> {
    return Promise.resolve(null);
  }
}
```

A real `OpenAISuggestionService` (or similar) can be swapped in later via the DI container without changing any UI code.

**Feature flag**: read from a config file or env variable:

```typescript
// src/config/featureFlags.ts  (new small file)
export const FEATURE_AI_SUGGESTIONS =
  process.env.FEATURE_AI_SUGGESTIONS === 'true' || false;
```

---

## 7. New Hook: `src/hooks/useTaskDetail.ts`

```typescript
export interface UseTaskDetailReturn {
  suggestion: SuggestionResult | null;
  loadingSuggestion: boolean;
}

/**
 * Fetches an optional AI suggestion for the currently-open task.
 * Does nothing when the feature flag is off (returns null immediately).
 */
export function useTaskDetail(
  task: Task | null,
  project: Project | null,
): UseTaskDetailReturn { ... }
```

The hook is kept tiny and entirely presentational — all AI calls go through `SuggestionService`.

---

## 8. UI Changes

### 8.1 Task Index (`pages/tasks/index.tsx`)

| What          | Before                                          | After                                        |
|---------------|-------------------------------------------------|----------------------------------------------|
| Summary cards | Two cards (Pending count, In-Progress count)    | **Removed entirely**                         |
| Layout order  | Header → Summary Cards → BlockerCarousel → Focus List | Header → **BlockerCarousel (hero)** → Focus List |

The `BlockerCarousel` wrapper in the parent screen moves from `pt-2` padding after the removed summary cards to sit directly under the header with `pt-4`.

### 8.2 `BlockerCarousel.tsx` — hero styling

Changes are purely presentational, no logic change:

- Section header font size: `13` → `16`, weight stays `700`.
- Add a subtle left-border accent: `#ef4444` (red) strip for blocker state, `#22c55e` (green) for winning state.
- Card width: `200` → `220`.
- Winning card: increase padding, font sizes (winning-title `16` → `18`).
- Accessible: ensure `accessibilityRole="header"` on the section label.

### 8.3 `TaskBottomSheet.tsx` — section reorder

**New scroll-body order** (top → bottom inside `ScrollView`):

1. **Next-In-Line list** (was 4th)
2. **Task description** (new — shown when `task.description` is set)
3. **Photo strip** (new — shown when `task.photos?.length > 0`)
4. **Quick Actions** row — `⚠ Mark as Blocked` + `📋 See Full Details`
5. Prerequisites list (was 3rd — moved down, secondary info)
6. Status pills (was 1st after header — now near bottom)
7. Priority pills (was 2nd — now last)
8. **AI Suggestion area** (new — gated by `FEATURE_AI_SUGGESTIONS`)

**Photo strip**: horizontally scrollable row of `60×60` thumbnail `Image` components. Tapping any navigates to `TaskDetails` (passes `taskId`). An "Add Photo" cell triggers the existing upload flow in `TaskDetails`.

**AI Suggestion area**:
```
┌─────────────────────────────────────────┐
│ 🤖 AI Insight  (badge: BETA)            │
│                                         │
│ "This may be caused by …"               │
│                                         │
│ ⚠ Disclaimer: AI-generated content …  │
└─────────────────────────────────────────┘
```

---

## 9. Test Plan

### Unit tests (`__tests__/unit/`)

| File                                            | What is tested                                                  |
|-------------------------------------------------|-----------------------------------------------------------------|
| `useTaskDetail.test.ts`                         | Returns `null` suggestion when flag is off; calls service when on |
| `StubSuggestionService.test.ts`                 | Always returns `null` synchronously                             |
| `TaskBottomSheet.test.tsx`                      | Section render order: Next-In-Line appears before Status pills  |
| `TaskBottomSheet.test.tsx`                      | Description renders when `task.description` is set              |
| `TaskBottomSheet.test.tsx`                      | AI area not rendered when flag is false                         |
| `TaskIndex.test.tsx` (update existing)          | `summary-pending-count` and `summary-in-progress-count` testIDs no longer in tree |
| `BlockerCarousel.test.tsx` (update existing)    | Hero container renders at root level with expected testID        |

### Integration tests

No new integration tests required for this PR (schema columns are additive/nullable; existing integration tests unaffected).

---

## 10. Risk & Trade-offs

| Risk | Mitigation |
|------|------------|
| Moving Status/Priority to bottom reduces discoverability for quick edits | Quick Actions row stays accessible; full edit still reachable via `📋 See Full Details` |
| `task.photos` is a new optional field — existing tasks have none | Render the photo strip only when `photos?.length > 0`; no breaking change |
| AI suggestion latency could freeze the sheet | `useTaskDetail` loads asynchronously; sheet renders immediately with suggestion injected after |
| New schema columns need migration | Columns are nullable; existing rows just have `NULL` values; auto-migration on restart |

---

## 11. Open Questions

1. **Photo storage**: ~~should `photos` hold local filesystem URIs, remote URLs, or both?~~ → **Both** (`file://` + `https://`). ✅
2. **AI provider**: ~~which LLM endpoint will back `OpenAISuggestionService`?~~ → **Stub is sufficient for now**; real adapter is a future ticket. ✅
3. **Subcontractor "Call" button**: ~~keep it in Quick Actions as a disabled state, or remove?~~ → **Keep as disabled** to hold the layout. ✅
4. **Lightbox**: ~~is a full-screen image viewer in scope?~~ → **Navigate to `TaskDetails` for now**; dedicated lightbox is a future enhancement. ✅

---

## 12. Files Changed Summary

| File | Type |
|------|------|
| `src/pages/tasks/index.tsx` | Edit |
| `src/components/tasks/BlockerCarousel.tsx` | Edit |
| `src/components/tasks/TaskBottomSheet.tsx` | Edit |
| `src/hooks/useTaskDetail.ts` | New |
| `src/infrastructure/ai/suggestionService.ts` | New |
| `src/config/featureFlags.ts` | New |
| `src/domain/entities/Task.ts` | Edit |
| `src/domain/entities/Project.ts` | Edit |
| `src/infrastructure/database/schema.ts` | Edit |
| `drizzle/` (generated migration) | Generated |
| `__tests__/unit/useTaskDetail.test.ts` | New |
| `__tests__/unit/StubSuggestionService.test.ts` | New |
| `__tests__/unit/TaskBottomSheet.test.tsx` | Edit |
| `__tests__/unit/TaskIndex.test.tsx` | Edit (if exists) |

---

*Ready for review. Please approve or request changes before implementation begins.*
