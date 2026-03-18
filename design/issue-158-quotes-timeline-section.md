# Design: Issue #158 — Project-level Quotes Section (Collapsible Timeline & Sticky Headings)

**Status**: ⏳ AWAITING APPROVAL — do not begin implementation  
**Author**: Copilot  
**Date**: 2026-03-18  
**GitHub Issue**: https://github.com/yhua045/builder-assistant/issues/158  
**Related Issue**: [#157 — Payments Timeline](https://github.com/yhua045/builder-assistant/issues/157)

---

## 1. User Stories

| # | Story |
|---|---|
| US-1 | As a Builder, I want a **Quotes** section on the Project Detail page so I can see all quotations for the project without leaving the project context. |
| US-2 | As a Builder, I want the Quotes section to show only **pending** (sent, awaiting my decision) quotes by default so I can immediately see what needs my attention. |
| US-3 | As a Builder, I want to collapse the Quotes section to reduce vertical scrolling when I only care about tasks. |
| US-4 | As a Builder, I want quick actions (open quote, accept, reject, attach document) per quotation card so I can act without navigating away. |
| US-5 | As a Builder, I want the section heading to stay visible (sticky) while I scroll through quotes, then yield when the next section arrives. |
| US-6 | As a Builder, I want a "Show all" toggle in the Quotes section header so I can see accepted/declined quotes when I need a historical view. |

---

## 2. Acceptance Criteria

| # | Criterion |
|---|---|
| AC-1 | A **Quotes** section appears in `ProjectDetail` below the Tasks section and can be independently expanded/collapsed. Default state: **collapsed**. |
| AC-2 | By default the Quotes section displays only **pending** quotations (`status === 'sent'`). The `TimelineSectionHeader` shows a count badge of pending quotes (e.g. "3 pending"). |
| AC-3 | A **"Show all"** toggle in the section header switches the view to include all statuses (`draft`, `sent`, `accepted`, `declined`). The count badge updates to reflect the full set (e.g. "7 total"). The toggle state is local to the session (not persisted). |
| AC-4 | Quotations are grouped by day (`Quotation.date` field, ISO date bucket `YYYY-MM-DD`) in a vertical timeline matching the Task timeline visual style. |
| AC-5 | Multiple quotations on the same day appear under a shared day header, ordered by `date` ascending. |
| AC-6 | Each quotation is rendered as a `QuotationCard` showing: reference number, vendor name, total (AUD), status badge, and expiry date if present. |
| AC-7 | A `TimelineSectionHeader` component wraps each major section (Tasks, Payments, Quotes) with a collapse toggle, item-count badge, and (optionally) a section total for Quotes. The section total shows the sum of `total` for non-`declined` quotes in the current view. |
| AC-8 | Sticky section heading: while the user scrolls within the Quotes section the `TimelineSectionHeader` label ("Quotes") remains pinned at the top of the scroll viewport; it yields when the next section header scrolls into view (implemented via `Animated` + `onScroll`). |
| AC-9 | Quick action — **Open**: navigates to the `QuotationDetail` screen. |
| AC-10 | Quick action — **Accept**: visible when `quotation.status === 'sent'`. For **task-linked quotes** (`quotation.taskId` set): calls `useAcceptQuote.acceptQuote(quotation.taskId)` which creates an Invoice and updates `task.quoteStatus`. For **standalone quotes** (no `taskId`): calls a new `acceptStandaloneQuotation` mutation that creates an Invoice from the quotation data and updates `quotation.status` to `'accepted'`. Both paths invalidate queries via `invalidations`. |
| AC-11 | Quick action — **Reject**: visible when `quotation.status === 'sent'`. For task-linked quotes: calls `useAcceptQuote.rejectQuote(quotation.taskId)`. For standalone quotes: updates `quotation.status` to `'declined'` via `UpdateQuotationUseCase`. Both invalidate queries. |
| AC-12 | Quick action — **Attach Document**: navigates to `TaskDetails` with `openDocument: true` when task-linked; navigates to `QuotationDetail` with document picker pre-opened when standalone. |
| AC-13 | Queries use `@tanstack/react-query` with named keys from the central `queryKeys` registry. All mutations invalidate the correct keys via the `invalidations` map. |
| AC-14 | Unit tests cover `useQuotationTimeline`: grouping logic, pending filter, "show all" toggle. Integration tests verify the full ProjectDetail page: Quotes section render, collapse/expand, pending-only default, and quick-action invalidations. |
| AC-15 | TypeScript strict mode passes (`npx tsc --noEmit` zero errors). |

---

## 3. Current State Analysis

### What already exists

| Concern | Current state |
|---|---|
| `Quotation` entity | `src/domain/entities/Quotation.ts` — full entity with `id`, `reference`, `projectId`, `taskId`, `vendorName`, `date`, `expiryDate`, `total`, `currency`, `status` (`draft/sent/accepted/declined`), `lineItems`, etc. |
| `QuotationRepository` | Interface supports `listQuotations({ projectId })` — sufficient to fetch all quotes for a project. |
| `DrizzleQuotationRepository` | Concrete Drizzle implementation already available. |
| `useQuotations` hook | Exists but scoped to `taskId` (for the task-detail modal); no project-scoped query. |
| `useAcceptQuote` hook | `acceptQuote(taskId)` and `rejectQuote(taskId)` already implemented; invalidations wired. |
| `queryKeys.quotations` | Currently keyed by `taskId` only — `['quotations', taskId?]`. No project-scoped key. |
| `invalidations` | Has `acceptQuotation` and `rejectQuotation` entries (task-scoped). No project-scoped quotation mutation entry. |
| `ProjectDetail.tsx` | Shows Project header card + Task Timeline only. No Payments or Quotes sections yet. |
| `TimelineDayGroup` | Exists — renders collapsible day-bucket with NativeWind. Purpose-built for tasks; can be used as a reference pattern but **not reused directly** (generic `TimelineList` is preferred for Quotes/Payments). |
| `TimelineSectionHeader` | **Does not exist yet** — to be created (shared by Payments #157 and Quotes #158). |
| `TimelineList` | **Does not exist yet** — to be created (generic day-grouped list renderer shared by both sections). |
| `QuotationCard` | **Does not exist yet** as a standalone timeline card (a task-detail `TaskQuotationSection` exists for inline display; a new `QuotationCard` is needed for the timeline row). |

### Gaps to fill

1. **`queryKeys`**: Add `quotationsByProject(projectId)` key.
2. **`invalidations`**: Add `quotationProjectMutated(ctx)` entry that busts `quotationsByProject`.
3. **Hook**: Create dedicated `useQuotationTimeline(projectId)` hook (mirrors the Tasks/Payments pattern — separate hook per section). Fetches project-level quotations, applies pending-only default filter, exposes grouped data and filter toggle.
4. **New components**:
   - `TimelineSectionHeader` — collapsible section header with count badge and optional "Show all" toggle (shared with Payments).
   - `TimelineList` — generic day-grouped item renderer (shared with Payments).
   - `QuotationCard` — quotation row card for the timeline.
5. **UI**: Add Quotes section to `ProjectDetail` using `TimelineSectionHeader` + `TimelineList` + `useQuotationTimeline`.
6. **Sticky heading**: Implement sticky-header scroll behaviour using `Animated` + `onScroll` — **in scope for this ticket**.
7. **Tests**: Unit tests for grouping / pending filter / toggle logic; integration tests for full page.

---

## 4. Architecture

### 4.1 No new domain interfaces needed

`QuotationRepository.listQuotations({ projectId })` is already the correct primitive. Grouping is a pure presentation concern, handled in the hook layer.

### 4.2 New `queryKeys` entry

```ts
// src/hooks/queryKeys.ts — add alongside existing 'quotations' key:
quotationsByProject: (projectId: string) =>
  ['quotationsByProject', projectId] as const,
```

This is intentionally distinct from `queryKeys.quotations(taskId)` (task-scoped) to avoid over-invalidating the task-detail query when a project-level mutation occurs.

### 4.3 New `invalidations` entry

```ts
// src/hooks/queryKeys.ts — add new context type:
export type QuotationProjectCtx = { projectId: string };

// Add to invalidations map:
/**
 * A quotation was created / updated / deleted at the project level.
 * Affects: project-level quotation list, project detail totals.
 */
quotationProjectMutated: (ctx: QuotationProjectCtx) => [
  queryKeys.quotationsByProject(ctx.projectId),
  queryKeys.projectDetail(ctx.projectId),
],
```

### 4.4 New hook: `useQuotationTimeline`

**Path**: `src/hooks/useQuotationTimeline.ts`

Follows the same pattern as `useProjectTimeline` (tasks) and `usePayments` (payments) — each section owns its dedicated hook. `ProjectDetail` composes them independently, keeping each hook small and focused.

```ts
export type QuotationStatusFilter = 'pending' | 'all';

export interface QuoteDayGroup {
  date: string;    // ISO date bucket YYYY-MM-DD or '__nodate__'
  label: string;   // "Thu 20 Dec" or "No Date"
  quotations: Quotation[];
}

export interface UseQuotationTimelineReturn {
  quoteDayGroups: QuoteDayGroup[];
  allQuoteDayGroups: QuoteDayGroup[];  // unfiltered — used for count badge in "show all" mode
  pendingCount: number;                // count of status==='sent' quotes
  totalCount: number;                  // count of all project quotes
  visibleTotal: number;                // sum of totals for non-declined quotes in current view
  statusFilter: QuotationStatusFilter;
  setStatusFilter: (f: QuotationStatusFilter) => void;
  loading: boolean;
  error: string | null;
  acceptQuotation: (quotation: Quotation) => Promise<void>;
  rejectQuotation: (quotation: Quotation) => Promise<void>;
  invalidateQuotes: () => Promise<void>;
}
```

**Internal behaviour:**
- `statusFilter` defaults to `'pending'` — only `status === 'sent'` quotations are included in `quoteDayGroups`.
- When `statusFilter === 'all'`, `quoteDayGroups` reflects all statuses.
- `allQuoteDayGroups` is always the full unfiltered set (needed so the section header can show "3 pending / 7 total").
- `acceptQuotation(quotation)`: if `quotation.taskId` is set, delegates to `useAcceptQuote.acceptQuote(taskId)` (creates Invoice + updates task). If standalone, calls a new `AcceptStandaloneQuotationUseCase` that creates an Invoice from quotation data and updates `quotation.status = 'accepted'`.
- `rejectQuotation(quotation)`: if `quotation.taskId` is set, delegates to `useAcceptQuote.rejectQuote(taskId)`. If standalone, calls `UpdateQuotationUseCase` to set `status = 'declined'`.
- Both mutations invalidate via `invalidations.quotationProjectMutated({ projectId })` + relevant task/invoice keys.

**Why a separate hook rather than extending `useProjectTimeline`?**  
The codebase pattern is one hook per section: `useProjectTimeline` owns tasks, `usePayments` owns payments. Keeping `useQuotationTimeline` separate means `useProjectTimeline` stays unchanged, each hook is independently testable, and `ProjectDetail` simply composes them.

### 4.5 New components

#### `TimelineSectionHeader`
**Path**: `src/components/projects/TimelineSectionHeader.tsx`

Props:
```ts
interface TimelineSectionHeaderProps {
  title: string;             // "Tasks" | "Payments" | "Quotes"
  itemCount: number;
  expanded: boolean;
  onToggle: () => void;
  /** Optional right-hand summary (e.g. total amount) */
  summary?: string;
  testID?: string;
}
```

Renders a `Pressable` row with:
- Section title (bold)
- Count badge (`px-1.5 py-0.5 bg-muted rounded-full`)
- Optional `summary` text (right-aligned, muted, e.g. "AUD 12,450")
- `ChevronDown` / `ChevronRight` icon indicating collapse state
- `LayoutAnimation.easeInEaseOut` on toggle

Visual style mirrors the existing "Expand All / Collapse All" button in `ProjectDetail.tsx` but is larger / section-scoped.

#### `TimelineList<T>`
**Path**: `src/components/projects/TimelineList.tsx`

Generic component that renders day-grouped items without knowing what each item is:

```ts
interface DayGroupGeneric<T> {
  date: string;
  label: string;
  items: T[];
}

interface TimelineListProps<T> {
  groups: DayGroupGeneric<T>[];
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Whether all groups are expanded (controlled) */
  expandedGroups: Record<string, boolean>;
  onToggleGroup: (date: string) => void;
  emptyMessage?: string;
  testID?: string;
}
```

This replaces the inline `dayGroups.map(…)` in `ProjectDetail` for both Tasks and Quotes, reducing duplication.

> **Note**: The existing `TimelineDayGroup` for tasks can be migrated to use `TimelineList` in the same PR, or left as-is to minimise scope. **Recommended**: leave `TimelineDayGroup` untouched and create `TimelineList` as a parallel component for Quotes (and later Payments). Migrate Tasks in a follow-up.

#### `QuotationCard`
**Path**: `src/components/projects/QuotationCard.tsx`

Props:
```ts
interface QuotationCardProps {
  quotation: Quotation;
  onOpen?: (quotation: Quotation) => void;
  onAccept?: (quotation: Quotation) => void;
  onReject?: (quotation: Quotation) => void;
  onAttachDocument?: (quotation: Quotation) => void;
  testID?: string;
}
```

Visual layout:
```
┌──────────────────────────────────────────────────────────┐
│  [FileText icon]  QT-2026-001   ·  Vendor Name           │
│                   AUD 14,500                   [Sent ●]  │
│  Issued: 15 Mar 2026   Expires: 15 Apr 2026              │
├──────────────────────────────────────────────────────────┤
│  [Open]  [Accept ✓]  [Reject ✗]  [Attach 📎]            │
└──────────────────────────────────────────────────────────┘
```

Status badge colours (consistent with `TaskQuotationSection`):
- `draft` → `bg-muted / text-muted-foreground`
- `sent` → `bg-blue-100 / text-blue-700`
- `accepted` → `bg-green-100 / text-green-700`
- `declined` → `bg-red-100 / text-red-600`

Quick action bar:
- **Open**: always visible — navigates to `QuotationDetail` screen.
- **Accept** / **Reject**: only when `status === 'sent'` (both task-linked and standalone quotes).
- **Attach**: always visible.

### 4.6 Sticky section heading — in scope

**Approach**: `Animated` + `onScroll` on the parent `ScrollView`.

Each `TimelineSectionHeader` is given an `onLayout` callback that records its `y` offset relative to the `ScrollView`. A lightweight `StickyOverlay` component (rendered as a sibling above the `ScrollView`) reads `scrollY` and the recorded `sectionLayouts` to determine which section header is currently active, then renders its title pinned at the top of the viewport.

When the next section's header scrolls into view, the sticky overlay transitions to that section's title (or hides if between sections).

Implementation sketch:

```tsx
// Inside ProjectDetail
const scrollY = useRef(new Animated.Value(0)).current;
const sectionLayouts = useRef<Record<string, { top: number; bottom: number }>>({});

// Each section header registers its y bounds:
onLayout={(e) => {
  sectionLayouts.current['quotes'] = {
    top: e.nativeEvent.layout.y,
    bottom: e.nativeEvent.layout.y + e.nativeEvent.layout.height,
  };
}}

// StickyOverlay uses Animated.event to derive active section label:
<Animated.ScrollView
  onScroll={Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: true },
  )}
  scrollEventThrottle={16}
>
```

> **Platform note**: On iOS, `ScrollView` natively supports `stickyHeaderIndices`. However, since Tasks / Payments / Quotes are not direct `ScrollView` children (they're wrapped in `View`s), native sticky indices won't work. The `Animated` approach is cross-platform and consistent with the NativeWind-only constraint established in issue #154 (§3.6).

> **New file**: `src/components/projects/StickyOverlay.tsx` — reads `scrollY` + `sectionLayouts` and renders the active section title in a `position: absolute` container at `top: 0`.

---

## 5. Files to Create / Modify

| Action | Path | Purpose |
|--------|------|---------|
| **Modify** | `src/hooks/queryKeys.ts` | Add `quotationsByProject` key + `QuotationProjectCtx` type + `quotationProjectMutated` invalidation entry |
| **Create** | `src/hooks/useQuotationTimeline.ts` | New dedicated hook: fetch, group, pending filter, accept/reject mutations |
| **Create** | `src/application/usecases/quotation/AcceptStandaloneQuotationUseCase.ts` | Accept a standalone (non-task-linked) quotation and auto-generate an Invoice |
| **Create** | `src/components/projects/TimelineSectionHeader.tsx` | Shared collapsible section header with count badge and optional "Show all" toggle (Tasks, Payments, Quotes) |
| **Create** | `src/components/projects/TimelineList.tsx` | Generic day-grouped timeline list renderer |
| **Create** | `src/components/projects/QuotationCard.tsx` | Quotation row card for the timeline |
| **Create** | `src/components/projects/StickyOverlay.tsx` | Sticky section title overlay driven by `Animated` + `scrollY` |
| **Modify** | `src/pages/projects/ProjectDetail.tsx` | Compose `useQuotationTimeline`; add Quotes section using new components; wire `Animated.ScrollView` + `StickyOverlay` |
| **Create** | `__tests__/unit/useQuotationTimeline.test.ts` | Unit tests: `groupQuotationsByDay`, pending filter, "show all" toggle, `pendingCount`, `visibleTotal` |
| **Create** | `__tests__/unit/QuotationCard.test.tsx` | Unit tests: renders fields, shows/hides accept/reject based on status |
| **Create** | `__tests__/integration/ProjectDetailQuotes.test.tsx` | Integration: Quotes section render, pending-only default, collapse/expand, accept action + invalidation |

---

## 6. Data Contracts

### `QuoteDayGroup` (exported from `useQuotationTimeline` for testing)
```ts
export interface QuoteDayGroup {
  date: string;        // ISO date bucket "YYYY-MM-DD" or "__nodate__"
  label: string;       // "Mon 15 Apr" or "No Date"
  quotations: Quotation[];  // sorted by .date asc within bucket
}
```

### `UseQuotationTimelineReturn`
```ts
export interface UseQuotationTimelineReturn {
  quoteDayGroups: QuoteDayGroup[];     // filtered by statusFilter
  allQuoteDayGroups: QuoteDayGroup[];  // all statuses — always unfiltered
  pendingCount: number;                // count of status === 'sent'
  totalCount: number;                  // count of all project quotations
  visibleTotal: number;                // sum of .total for non-declined in current view
  statusFilter: 'pending' | 'all';     // defaults to 'pending'
  setStatusFilter: (f: 'pending' | 'all') => void;
  loading: boolean;
  error: string | null;
  acceptQuotation: (quotation: Quotation) => Promise<void>;
  rejectQuotation: (quotation: Quotation) => Promise<void>;
  invalidateQuotes: () => Promise<void>;
}
```

### `useProjectTimeline` — unchanged
`UseProjectTimelineReturn` is **not modified**. The tasks hook remains as-is; `ProjectDetail` composes `useProjectTimeline` and `useQuotationTimeline` independently.

---

## 7. `ProjectDetail` Layout After Changes

```
┌─ Project Header Card ────────────────────────────────────┐
│  Name, location, status, start/end, owner contact        │
└──────────────────────────────────────────────────────────┘

[sticky overlay — active section title pinned here while scrolling]

[Tasks ▼] ─────────────────────── 12 tasks  [Expand All]
  20        ● 20 Mar
  Thu           [TaskCard] Foundation pour
                [TaskCard] Inspection — blocked
  27        ● 27 Mar
  Thu           [TaskCard] Frame delivery

[Quotes ▶] ───── 3 pending  AUD 41,250  [Show all (7)]
  (collapsed by default)

[Payments ▶] ──────────────────── 5 payments  (future #157)
  (collapsed)
```

Quotes section default state: **collapsed**; filter default: **pending only** (`status === 'sent'`).  
Tasks section default state: **expanded** (no change from current behaviour).

---

## 8. Test Plan

### Unit tests (`__tests__/unit/`)

| File | Tests |
|---|---|
| `useQuotationTimeline.test.ts` | `groupQuotationsByDay` groups correctly for single-day, multi-day, undated; sorts within day; `__nodate__` bucket appended last. |
| `useQuotationTimeline.test.ts` | Default `statusFilter === 'pending'` returns only `sent` quotes in `quoteDayGroups`; `allQuoteDayGroups` always returns all. |
| `useQuotationTimeline.test.ts` | Calling `setStatusFilter('all')` updates `quoteDayGroups` to include all statuses. |
| `useQuotationTimeline.test.ts` | `pendingCount` reflects only `sent` quotes; `totalCount` reflects all; `visibleTotal` excludes `declined`. |
| `useQuotationTimeline.test.ts` | `acceptQuotation` calls task-linked path when `taskId` set; standalone path otherwise. |
| `useQuotationTimeline.test.ts` | Hook returns empty arrays and `loading: false` when `projectId` is empty. |
| `QuotationCard.test.tsx` | Renders `reference`, `vendorName`, `total` (formatted AUD), `status` badge. |
| `QuotationCard.test.tsx` | Accept / Reject buttons visible when `status === 'sent'` regardless of `taskId`. |
| `QuotationCard.test.tsx` | Accept / Reject buttons hidden when `status === 'accepted'` or `'declined'`. |
| `TimelineSectionHeader.test.tsx` | Renders title and count badge; toggle calls `onToggle`; chevron direction matches `expanded`. |
| `TimelineSectionHeader.test.tsx` | "Show all" toggle renders when `onToggleFilter` prop provided; fires callback on press. |

### Integration tests (`__tests__/integration/`)

| File | Tests |
|---|---|
| `ProjectDetailQuotes.test.tsx` | Quotes section renders in ProjectDetail; starts collapsed; expands on header press. |
| `ProjectDetailQuotes.test.tsx` | Default view shows only `sent` quotes; `draft`/`accepted`/`declined` are hidden until "Show all" is pressed. |
| `ProjectDetailQuotes.test.tsx` | "Show all" toggle updates item count badge and renders additional quotation cards. |
| `ProjectDetailQuotes.test.tsx` | Pressing Accept on a `sent` task-linked quotation calls `useAcceptQuote.acceptQuote(taskId)` and triggers `invalidations.acceptQuotation`. |
| `ProjectDetailQuotes.test.tsx` | Pressing Accept on a standalone `sent` quotation calls `AcceptStandaloneQuotationUseCase` and triggers `invalidations.quotationProjectMutated`. |
| `ProjectDetailQuotes.test.tsx` | `quotationsByProject` query is called with correct `projectId`. |

---

## 9. Open Questions

| # | Question | Proposed default |
|---|---|---|
| OQ-1 | Should Accept/Reject work on the standalone `Quotation.status` field (via `UpdateQuotationUseCase`) or only on task-linked quotes (via `useAcceptQuote` which also generates an invoice)? | **Resolved** — both task-linked and standalone quotes generate an Invoice on Accept. Implemented via `AcceptStandaloneQuotationUseCase` for the standalone path (see §4.4). |
| OQ-2 | Should the Quotes section show a right-hand total in the section header? | **Resolved** — display sum of `total` for non-`declined` quotes in the current view as "AUD x,xxx" (see AC-7). |
| OQ-3 | Should sticky heading be in scope for this ticket, or deferred to a follow-up? | **Resolved — in scope**. Implemented via `Animated.ScrollView` + `StickyOverlay` (see §4.6 and Files table). |
| OQ-4 | Should `TimelineList` be used to refactor the existing Tasks section in this same PR? | **Resolved** — No. Leave Tasks section using its current `TimelineDayGroup`. Refactor is a follow-up. |
| OQ-5 | Where does navigation go when "Open" is tapped on a standalone quotation? | **Resolved** — navigate to `QuotationDetail` screen (see AC-9). If `QuotationDetail` does not yet exist, it must be created as a minimal screen as part of this ticket or blocked as a dependency. **Flag at implementation start.**

---

## 10. Implementation Order (TDD)

Follow the standard TDD workflow from `CLAUDE.md`:

1. **`queryKeys`** — add `quotationsByProject` key + `QuotationProjectCtx` type + `quotationProjectMutated` invalidation entry. Write unit test asserting correct key shapes.
2. **`groupQuotationsByDay`** — pure helper; write unit tests first (red), implement (green).
3. **`useQuotationTimeline`** — write hook unit tests covering pending filter, "show all" toggle, `pendingCount`, `visibleTotal`, accept/reject paths (red); implement hook (green).
4. **`AcceptStandaloneQuotationUseCase`** — write unit tests first (red); implement use case + register in DI (green).
5. **`QuotationCard`** — write render unit tests (red); implement component (green).
6. **`TimelineSectionHeader`** — write unit tests (red); implement with optional "Show all" toggle (green).
7. **`TimelineList`** — write unit tests (red); implement (green).
8. **`StickyOverlay`** — implement after `TimelineList`; verify with manual integration test on device/simulator.
9. **`ProjectDetail`** — compose `useQuotationTimeline` alongside existing `useProjectTimeline`; add Quotes section; wire `Animated.ScrollView` + `StickyOverlay`. Write integration tests (red → green).
10. **PR + review** — reference failing tests and design doc.
11. **Progress note** — update `progress.md` after merge.

---

## 11. Scope Boundaries

**In scope for this ticket:**
- `useQuotationTimeline` hook with pending-only default filter and "show all" toggle.
- Quotes section (collapsible) in `ProjectDetail` backed by real data.
- `QuotationCard`, `TimelineSectionHeader`, `TimelineList`, `StickyOverlay` components.
- `groupQuotationsByDay` pure helper.
- `queryKeys.quotationsByProject` + `invalidations.quotationProjectMutated`.
- Accept / Reject quick actions for **both task-linked and standalone** quotes.
- `AcceptStandaloneQuotationUseCase` (new use case for standalone acceptance).
- Sticky section heading via `Animated.ScrollView` + `StickyOverlay`.
- Unit + integration tests.

**Out of scope (follow-up tickets):**
- Payments section in `ProjectDetail` (issue #157).
- Refactoring Tasks section to use `TimelineList` (OQ-4 — separate PR to avoid scope creep).
- Pagination for projects with > 500 quotations.
