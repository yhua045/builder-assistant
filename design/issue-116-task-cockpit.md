# Design: Issue #116 — Task Cockpit & Task Detail — Blocker Bar, Focus-3, Bottom Sheet, Quick Actions

**Status**: PLANNING — brainstorm & feasibility analysis  
**Author**: Copilot  
**Date**: 2026-03-05  
**GitHub Issue**: https://github.com/yhua045/builder-assistant/issues/116  

---

## 0. Document Purpose

This document focuses on **two planning concerns** before any implementation begins:

1. **Feasibility** — Are the key concepts (critical path, lead-time shift, blocker detection, Focus-3) practical for an owner-builder who spends most of their day in traffic and on-site?
2. **Data Points** — What must be stored vs. what can be derived at read-time? What is the minimal schema change that makes the cockpit useful without turning every task update into a data-entry burden?

---

## 1. Quick Recap — What the Ticket Asks For

| Area | Description |
|---|---|
| **Blocker Bar** | Horizontal carousel of red/yellow badges showing tasks that are *actively blocking* downstream work. |
| **Focus-3** | Three critical-path tasks, each with a "days-shifted" impact indicator. |
| **Task Bottom Sheet** | Slide-up card on tap: prerequisites + completion %, Next-In-Line dependents, Quick Actions. |
| **Quick Actions** | Mark as Blocked, Upload Photo, Call Subcontractor — large tap targets for on-site use. |
| **Dependency Logic** | Block propagation, `percentComplete`, critical-path flag, impact-delta calculation. |

---

## 2. Feasibility Analysis — Is This Practical for an Owner-Builder?

### 2.1 Who Is the User?

An **owner-builder** is not a full-time project manager. They:

- Spend **2–4 hours/day driving** between suppliers, council offices, and the site.
- Spend **4–6 hours/day on-site** physically supervising or doing work.
- Have **< 30 min/day** of "admin time" — usually at night on the couch.
- Use a phone single-handed, often in sunlight, with dirty/gloved fingers.
- Manage **1 project** at a time (occasionally 2), with **15–60 active tasks**.
- Rarely think in formal PM terminology ("critical path", "lead time"); they think in terms of *"what's holding me up?"* and *"what's next?"*.

### 2.2 Concept-by-Concept Feasibility

#### A. Blocker Bar — ✅ HIGH VALUE, LOW FRICTION

| Aspect | Assessment |
|---|---|
| **Value** | The single most useful thing for a builder. "Show me what's stuck" is exactly the question they ask every morning. |
| **Data needed** | Task status (`blocked`) + task dependency edges + due dates. We already have all three in the schema. |
| **User effort** | Zero extra input if we auto-derive blockers from dependency edges. If a prerequisite task is overdue or marked blocked, the dependent task automatically appears. |
| **Risk** | Only works if the user has actually entered dependencies. If they haven't, the bar is empty and useless. |
| **Mitigation** | Fallback: also show tasks explicitly set to `status = 'blocked'` even without dependency edges (manual blockers). This means the bar is always useful even for users who never set up dependencies. |

**Recommendation**: Ship it. Keep it dual-mode — auto-blocked (from deps) + manual-blocked (from explicit status toggle).

#### B. Focus-3 (Critical-Path Tasks) — ⚠️ MEDIUM VALUE, NEEDS SIMPLIFICATION

| Aspect | Assessment |
|---|---|
| **Value** | Knowing the "next 3 most important things" is useful. But "critical path" in the CPM sense requires **every task to have a duration estimate and dependency links** — owner-builders won't maintain that level of detail. |
| **Data needed (formal CPM)** | Duration estimates, full dependency graph (all tasks linked), scheduled start/end dates for every task. The current schema has `dueDate` and `durationEstimate` but neither is populated for most tasks. |
| **User effort (formal CPM)** | Very high. The user would need to set duration + dependencies for every task and keep them current. This is project-management-software-level data entry. **Not practical.** |
| **Alternative: priority + due-date heuristic** | Instead of computing a formal critical path, define "Focus-3" as: the top 3 non-completed tasks, sorted by a composite score of `priority` (urgent > high > medium > low) + `dueDate` proximity + `blocked dependents count`. This requires **zero extra data entry** — it uses fields the user already sets when creating a task. |

**Recommendation**: Do NOT implement formal CPM. Implement a **"smart sort" heuristic** that feels like a critical path to the user but requires no extra data. Optionally allow the user to pin a `isCriticalPath` boolean flag on a task for manual override ("this is critical, always show me this").

##### Focus-3 Heuristic (Proposed)

```
score(task) =
  priorityWeight(task.priority)           // urgent=100, high=70, medium=40, low=10
  + dueDateUrgency(task.dueDate)          // 0–100 based on days until due (0=distant, 100=overdue)
  + blockedDependentsBoost(task)           // +50 per downstream task that is waiting on this task
  + criticalPathManualBoost(task)          // +200 if user manually flagged isCriticalPath
```

Top 3 by score are shown. All inputs already exist or are trivially derivable at query time.

#### C. Impact Delta ("−2 Days") — ⚠️ LOW VALUE FOR EFFORT, HIGH RISK OF CONFUSION

| Aspect | Assessment |
|---|---|
| **Value** | Theoretically powerful — "this task is 2 days late so the whole project slips 2 days". |
| **Data needed** | A full dependency graph with accurate duration estimates AND a baseline schedule to compare against. |
| **User effort** | Extremely high. The user would need to maintain an "original schedule" plus current progress. This is MS Project territory. |
| **Risk** | If input data is incomplete (e.g., 5 of 30 tasks have durations), the delta is meaningless or worse, misleading. A wrong number is worse than no number. |
| **Alternative: simple "days overdue" indicator** | Show `daysOverdue = today - task.dueDate` for each Focus-3 task. Red if positive, green if negative (ahead of schedule). This is always accurate because `dueDate` is a concrete, user-supplied date. No computation needed. |

**Recommendation**: Do NOT implement impact-delta / schedule-shift calculation. Replace with a simple **"days overdue / days remaining"** indicator. If a task is overdue, show `🔴 3d overdue`. If it's due tomorrow, show `🟡 Due tomorrow`. If it's 5 days away, show `🟢 5d left`. This is instantly understandable without any PM knowledge.

#### D. percentComplete — ⚠️ USEFUL BUT NEEDS GUARD RAILS

| Aspect | Assessment |
|---|---|
| **Value** | Seeing "Scaffold Assembly — 80%" is useful context in the prerequisite section. |
| **Data needed** | A `percentComplete` integer field (0–100) on each task. |
| **User effort** | The user has to update progress periodically. This is a real burden if they have 30+ tasks. |
| **Risk** | Stale data. Users set it to 50% once and never update it. A stale percentComplete is worse than no percentComplete because it creates false confidence. |
| **Alternative A: status-only** | Don't track %. Instead use the existing 5-state status (`pending` → `in_progress` → `completed` / `blocked` / `cancelled`). Show status badges in the prerequisite list. This already works with zero new fields. |
| **Alternative B: coarse progress** | Instead of 0–100, offer 4 levels: `Not Started` / `Started` / `Almost Done` / `Done` (mapped to 0 / 33 / 66 / 100). This is two taps to update instead of a freeform slider. |

**Recommendation**: Start with **status-only** (Alternative A). If users request more granularity, add coarse progress (Alternative B) in a future iteration. Do NOT add a 0–100 slider — it will go stale.

#### E. Task Bottom Sheet — ✅ HIGH VALUE

| Aspect | Assessment |
|---|---|
| **Value** | Quick peek at "why is this task blocked?" and "what's waiting on it?" without navigating to a full detail page. Perfect for on-site use. |
| **Data needed** | Dependency edges (already stored), task statuses (already stored). |
| **User effort** | Zero — it's a read-only presentation layer. |

**Recommendation**: Ship it. Focus on making it fast to open and easy to read in sunlight.

#### F. Quick Actions — ✅ HIGH VALUE, LOW FRICTION

| Aspect | Assessment |
|---|---|
| **Value** | "Mark as Blocked" + "Upload Photo" + "Call Subcontractor" are the exact actions a builder does 10x/day on site. Large buttons on a half-sheet is ideal UX for one-handed, gloved-finger use. |
| **Data needed** | Existing fields: status toggle, photo attachment flow, subcontractor contact info. |
| **User effort** | One tap each. This is the opposite of data entry — it's the payoff for having set things up. |

**Recommendation**: Ship it. Wire to existing flows (camera, phone dialler, status update).

### 2.3 Feasibility Summary Matrix

| Feature | User Value | Data Entry Burden | Data Already Available? | Recommendation |
|---|---|---|---|---|
| Blocker Bar | 🟢 High | None (auto-derived) | ✅ Yes (deps + status + dueDate) | **Ship** |
| Focus-3 (heuristic) | 🟢 High | None (uses existing fields) | ✅ Yes (priority + dueDate + deps) | **Ship** (heuristic, not formal CPM) |
| Focus-3 (formal CPM) | 🟡 Medium | 🔴 Very High | ❌ No (missing durations on most tasks) | **Do NOT ship** |
| Impact Delta (schedule shift) | 🟡 Medium | 🔴 Very High | ❌ No (no baseline schedule) | **Do NOT ship** — replace with "days overdue" |
| percentComplete | 🟡 Medium | 🟡 Medium (goes stale) | ❌ No (new field) | **Defer** — use status-only for now |
| Bottom Sheet (prereqs/next-in-line) | 🟢 High | None (read display) | ✅ Yes | **Ship** |
| Quick Actions | 🟢 High | None (1-tap actions) | ✅ Yes (existing flows) | **Ship** |

---

## 3. Data Points — Stored vs. Derived

### 3.1 Current Schema State (What We Already Have)

The existing schema already stores most of what we need:

| Table/Column | Exists? | Used By |
|---|---|---|
| `tasks.status` (pending/in_progress/completed/blocked/cancelled) | ✅ | Blocker Bar (manual blockers) |
| `tasks.priority` (low/medium/high/urgent) | ✅ | Focus-3 scoring |
| `tasks.due_date` | ✅ | Blocker Bar (overdue detection), Focus-3 (urgency scoring), "days overdue" indicator |
| `tasks.subcontractor_id` | ✅ | Quick Action: Call Subcontractor |
| `task_dependencies` (task_id → depends_on_task_id) | ✅ | Blocker Bar (auto-derived blockers), Bottom Sheet (prereqs + next-in-line) |
| `task_delay_reasons` | ✅ | Contextual info in bottom sheet |
| `tasks.assigned_to` | ✅ | Potential future use |
| `tasks.scheduled_at`, `tasks.is_scheduled` | ✅ | Scheduling context |
| `contacts` table (name, phone, email, trade) | ✅ | Quick Action: Call Subcontractor |

### 3.2 New Fields to Store (Schema Changes)

Based on the feasibility analysis, the net-new persistent fields needed are **minimal**:

| Field | Table | Type | Why | Notes |
|---|---|---|---|---|
| `is_critical_path` | `tasks` | `INTEGER (boolean)` | Manual user override to pin a task into Focus-3. | Optional. `DEFAULT false`. Zero impact on existing tasks. |

That's it. **One new column.** Everything else is derived at read time.

### 3.3 Deferred Fields (NOT adding now, but earmarked)

| Field | Why Deferred | When to Add |
|---|---|---|
| `percent_complete` (INTEGER 0–100) | Goes stale, adds data-entry burden. Status enum is sufficient for V1. | Add when users request more granularity; use coarse 4-level enum, not a freeform slider. |
| `estimated_duration_hours` (already on Task entity but rarely set) | Required for formal CPM but not for the heuristic Focus-3. | Add if we ever implement forward/backward pass scheduling. |
| `baseline_start_date` / `baseline_end_date` | Required for true schedule-shift (impact delta) calculations. | Only if we build a Gantt view / formal scheduling module. |
| `critical_path_order` (INTEGER) | A system-computed field for CPM ordering. | Only if we implement automatic critical-path analysis. |

### 3.4 Derived Data Points (Computed at Read-Time in Use Case / Hook)

These are **never stored** — they're computed fresh whenever the cockpit view loads:

| Derived Data Point | Formula / Logic | Source Fields |
|---|---|---|
| **isAutoBlocked(task)** | `true` if ANY task in `task_dependencies` where `depends_on_task_id` points to a task that is overdue (`due_date < now && status != 'completed'`) or has `status = 'blocked'` | `task_dependencies`, target task's `due_date` + `status` |
| **blockerList** | All tasks where `status = 'blocked'` OR `isAutoBlocked(task) = true`, excluding completed/cancelled tasks | `tasks.status`, `task_dependencies` |
| **blockerSeverity(task)** | `'red'` if any prerequisite is `blocked` or overdue by > 2 days; `'yellow'` if any prerequisite is overdue by 0–2 days or has `status = 'in_progress'` but is past due date | `task_dependencies`, prereq `due_date` + `status` |
| **focus3Score(task)** | `priorityWeight + dueDateUrgency + blockedDependentsBoost + criticalPathManualBoost` (see §2.2.B) | `tasks.priority`, `tasks.due_date`, `task_dependencies`, `tasks.is_critical_path` |
| **focus3List** | Top 3 non-completed tasks by `focus3Score`, excluding tasks already in blocker list | Derived from `focus3Score` |
| **daysOverdue(task)** | `max(0, floor((now - task.due_date) / 86400000))` | `tasks.due_date` |
| **daysRemaining(task)** | `max(0, floor((task.due_date - now) / 86400000))` | `tasks.due_date` |
| **urgencyLabel(task)** | `🔴 Xd overdue` if overdue, `🟡 Due today` or `🟡 Due tomorrow`, `🟢 Xd left` otherwise | `tasks.due_date` |
| **prerequisitesOf(task)** | Tasks that `task` depends on (from `task_dependencies` where `task_id = task.id`) | `task_dependencies` |
| **nextInLine(task)** | Tasks that depend on `task` (from `task_dependencies` where `depends_on_task_id = task.id`) | `task_dependencies` |
| **blockedDependentsCount(task)** | Count of tasks in `nextInLine(task)` that cannot proceed because `task` is not completed | `task_dependencies` |

### 3.5 Data Flow Diagram

```
                     ┌──────────────────────────────────────┐
                     │          SQLite (Drizzle)             │
                     │                                       │
                     │  tasks (+ is_critical_path)           │
                     │  task_dependencies                    │
                     │  task_delay_reasons                   │
                     │  contacts                             │
                     └──────────────┬───────────────────────┘
                                    │
                                    ▼
                     ┌──────────────────────────────────────┐
                     │  TaskRepository (read queries)        │
                     │  - findAll / findByProjectId          │
                     │  - findDependencies / findDependents  │
                     └──────────────┬───────────────────────┘
                                    │
                                    ▼
                     ┌──────────────────────────────────────┐
                     │  GetCockpitDataUseCase                │
                     │  (application layer)                  │
                     │                                       │
                     │  Computes:                            │
                     │  - blockerList + severity             │
                     │  - focus3List + urgencyLabel          │
                     │  - For each task: prereqs, nextInLine │
                     └──────────────┬───────────────────────┘
                                    │
                                    ▼
                     ┌──────────────────────────────────────┐
                     │  useCockpitData() hook                │
                     │  (React state + memoisation)          │
                     └──────────────┬───────────────────────┘
                                    │
                          ┌─────────┼─────────┐
                          ▼         ▼         ▼
                     ┌─────────┐ ┌───────┐ ┌────────────┐
                     │ Blocker │ │Focus-3│ │Bottom Sheet│
                     │ Bar     │ │ List  │ │(on tap)    │
                     └─────────┘ └───────┘ └────────────┘
```

---

## 4. Key Design Decisions & Trade-offs

### Decision 1: Heuristic Focus-3 vs. Formal Critical Path Method (CPM)

| | Heuristic | Formal CPM |
|---|---|---|
| **Accuracy** | Approximate — surfaces "probably most important" tasks | Mathematically correct longest path |
| **Data required** | priority + dueDate + deps (already stored) | Complete dependency graph + duration estimates for ALL tasks |
| **User burden** | None | Very high (must fill in durations + link everything) |
| **Failure mode** | Shows reasonable defaults even with sparse data | Shows garbage / empty result with sparse data |
| **Suitable for 1-person builder** | ✅ Yes | ❌ No — requires PM discipline |

**Decision**: Heuristic. We can always upgrade later if users demand formal CPM.

### Decision 2: "Days Overdue" vs. "Impact Delta (Schedule Shift)"

| | Days Overdue | Impact Delta |
|---|---|---|
| **Meaning** | "This task is X days past its due date" | "This task being late shifts the whole project end date by X days" |
| **Data required** | `task.dueDate` + `today` | Full dependency graph + duration estimates + baseline schedule |
| **Always accurate** | ✅ Yes (date math) | ❌ No (garbage in → garbage out) |
| **Understandable to builder** | ✅ Instantly | ⚠️ Confusing if wrong |

**Decision**: Days Overdue. Impact delta is a V2+ feature that requires the app to have a scheduling module first.

### Decision 3: No percentComplete in V1

**Rationale**: The 5-state status enum (`pending → in_progress → completed → blocked → cancelled`) already maps to what a builder actually updates. Adding a percentage slider creates a data-entry habit that owner-builders won't maintain. Stale data is worse than no data.

**Future**: If needed, introduce a 4-level coarse enum (`not_started | started | almost_done | done`) mapped to 0/33/66/100 — one extra tap, no mental math.

### Decision 4: Dual-Mode Blocker Bar (auto + manual)

A task appears in the Blocker Bar if **either**:

1. **Auto-blocked**: At least one of its prerequisites (via `task_dependencies`) is overdue or has `status = 'blocked'`, AND
2. **Manual-blocked**: Its own `status = 'blocked'` (set explicitly by the user via Quick Action).

This ensures the blocker bar is useful even when the user has set up zero dependency edges — they can still tap "Mark as Blocked" on any task and it appears in the bar.

### Decision 5: `is_critical_path` as a Manual Override, Not a Computed Flag

We are NOT computing critical path automatically. Instead, `is_critical_path` is a boolean the user can toggle: "I know this task is critical — always show it in my Focus-3." This respects the builder's domain knowledge without requiring them to model the full dependency graph.

---

## 5. Open Questions (Require User Input)

| # | Question | Options | Impact |
|---|---|---|---|
| OQ-1 | Should Focus-3 be **project-scoped** or **global across all projects**? | (a) Per-project — user selects project first, then sees Focus-3 for that project. (b) Global — shows top 3 across ALL active projects. | If the builder only has 1 project, (b) is simpler. If they have 2, (a) might be clearer. Could default to (b) and add a project filter pill later. ***Decision*** project scoped.
| OQ-2 | Should the Bottom Sheet replace navigation to `TaskDetailsPage`, or should it be a "peek" that has a "See Full Details" button? | (a) Replace — bottom sheet IS the detail view. (b) Peek — bottom sheet is quick-glance + quick-actions, with a link to the full detail page for documents/delays/etc. | (b) is safer — less disruption to existing flows, and the full detail page already has document/delay/subcontractor sections that would be hard to fit in a bottom sheet. ***Decision*** (b) peek mode.
| OQ-3 | How many tasks does the typical user have per project? | Rough estimate: 15–60. | Affects whether we need pagination or can load all tasks into memory for the heuristic scoring. At < 100 tasks, in-memory sort is fine. ***Decision*** the "active tasks" should be less than 20. The 'active' means the current tasks that are either being working on, or scheduled to worked on soon. The total number of tasks for a given project could be close to 200 to 300.
| OQ-4 | Should "Mark as Blocked" from Quick Actions also prompt for a delay reason? | (a) Yes — always show delay reason picker when blocking. (b) No — just toggle status; delay reason is optional and can be added from detail page. | (a) is more complete but slower. (b) is faster for on-site use. Could do (b) with an optional "Add reason?" nudge after toggling. ***Decision*** (b) with an optional "Add reason?"
| OQ-5 | Should we add a `scheduledStartDate` field to tasks? | Currently we have `scheduledAt` (a single point-in-time) and `dueDate`. For the cockpit, `dueDate` is sufficient. But if we ever want Gantt-like views, we'll need both start and end. | Not needed for V1. Earmark for future. |***Decision*** defer adding `scheduledStartDate` until we build a scheduling module.

---

## 6. Proposed Schema Migration

Only **one** new column is needed:

```sql
-- Migration: 00XX_add_task_critical_path_flag.sql
ALTER TABLE tasks ADD COLUMN is_critical_path INTEGER DEFAULT 0;
```

Drizzle schema change:

```typescript
// In schema.ts, inside the `tasks` table definition, add:
isCriticalPath: integer('is_critical_path', { mode: 'boolean' }).default(false),
```

Domain entity change:

```typescript
// In Task interface, add:
isCriticalPath?: boolean;
```

---

## 7. Proposed Use Case / Hook Sketch

### GetCockpitDataUseCase

```typescript
interface CockpitData {
  blockers: BlockerItem[];    // tasks in blocker bar
  focus3: FocusItem[];        // top 3 priority tasks
}

interface BlockerItem {
  task: Task;
  severity: 'red' | 'yellow';
  blockedPrereqs: Task[];     // which prerequisites are causing the block
  nextInLine: Task[];         // what downstream tasks are waiting
}

interface FocusItem {
  task: Task;
  score: number;
  urgencyLabel: string;       // "🔴 3d overdue" / "🟢 5d left"
  nextInLine: Task[];         // what's waiting on this
}
```

### useCockpitData hook

```typescript
function useCockpitData(projectId?: string): {
  cockpit: CockpitData | null;
  loading: boolean;
  refresh: () => Promise<void>;
}
```

---

## 8. Implementation Phases (Suggested — Not In Scope Yet)

| Phase | Scope | Schema Change? |
|---|---|---|
| **Phase 1** | Schema: add `is_critical_path`. Domain: update Task entity. Use case: `GetCockpitDataUseCase` with blocker logic + focus-3 heuristic. Hook: `useCockpitData()`. Unit + integration tests. | Yes (1 column) |
| **Phase 2** | UI: `BlockerCarousel` component, `FocusList` component, update `TasksScreen` to show cockpit view. | No |
| **Phase 3** | UI: `TaskBottomSheet` with prereqs, next-in-line, Quick Actions. Wire to existing photo/call flows. | No |
| **Phase 4** | Polish: animations, sunlight-friendly colors, on-site usability testing. | No |

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Users don't set up dependencies → Blocker Bar is empty | High | Medium | Dual-mode: manual `status='blocked'` always works. Nudge users to add deps over time. |
| Focus-3 heuristic surfaces wrong tasks | Medium | Low | Users can manually flag `isCriticalPath` to override. Heuristic degrades gracefully. |
| Building formal CPM creates complexity we can't maintain | High | High | Explicitly deferred. Heuristic is simpler and more robust with sparse data. |
| percentComplete goes stale → false confidence | High | Medium | Not adding it in V1. Status enum is sufficient. |
| Bottom sheet feels redundant with TaskDetailsPage | Low | Low | Bottom sheet is "peek mode" + quick actions. Full detail page remains for deep editing. |

---

## Appendix A: Comparison with Existing Schema

Fields the cockpit needs, mapped to what **already exists**:

| Cockpit Need | Existing Field | Gap? |
|---|---|---|
| Task status | `tasks.status` (5 values) | ✅ None |
| Task priority | `tasks.priority` (4 values) | ✅ None |
| Task due date | `tasks.due_date` | ✅ None |
| Dependency edges | `task_dependencies` table | ✅ None |
| Subcontractor info | `tasks.subcontractor_id` → `contacts` | ✅ None |
| Delay context | `task_delay_reasons` | ✅ None |
| Manual critical flag | `tasks.is_critical_path` | ❌ **New column needed** |
| percentComplete | — | ❌ Deferred (not adding) |
| Duration estimate | `Task.durationEstimate?` (entity-only, not in DB) | ❌ Deferred (not adding) |
| Baseline schedule | — | ❌ Deferred (not adding) |

## Appendix B: Focus-3 Scoring — Worked Example

Given 5 tasks:

| Task | Priority | Due Date | Blocked Dependents | isCriticalPath |
|---|---|---|---|---|
| Foundation Pour | urgent | 2 days ago (overdue) | 3 | false |
| Frame Delivery | high | tomorrow | 1 | false |
| Paint Selection | low | 10 days from now | 0 | false |
| Roof Inspection | medium | 5 days from now | 2 | true |
| Plumbing Rough-In | high | 3 days from now | 0 | false |

Scores:

| Task | Priority Wt | Due Urgency | Dep Boost | CP Boost | **Total** |
|---|---|---|---|---|---|
| Foundation Pour | 100 | 100 (overdue) | 150 (3×50) | 0 | **350** |
| Roof Inspection | 40 | 60 | 100 (2×50) | 200 | **400** |
| Frame Delivery | 70 | 90 (due tomorrow) | 50 (1×50) | 0 | **210** |
| Plumbing Rough-In | 70 | 75 | 0 | 0 | **145** |
| Paint Selection | 10 | 20 | 0 | 0 | **30** |

**Focus-3 result**: Roof Inspection (400), Foundation Pour (350), Frame Delivery (210).

Note: Foundation Pour is also in the Blocker Bar (overdue with dependents). The Focus-3 list filters out tasks already shown in the Blocker Bar to avoid duplication? **Open question** — or do we keep them in both? Showing in both reinforces urgency; removing avoids clutter. Leaning towards **showing in both but with a subtle visual link** ("also in Blockers ↑").
