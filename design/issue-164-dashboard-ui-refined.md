# Design: Issue #164 — Dashboard UI Refined (Phase 2)

**Date:** 2026-03-20  
**Branch:** `feature/164-dashboard-ui-refined`  
**Source of truth:** `src/pages/dashboard/index.mock.tsx` (Projects List section)  
**Supersedes:** §4.5 of `design/issue-164-dashboard-ui.md` (UI section only; domain/hook plan stands)

---

## 1. Summary of Changes

The original design doc established the architecture and hook contracts. This document records the
**precise visual delta** between the current component implementations in the worktree and the
refined mock — providing exact Tailwind tokens, icon sizes, and layout rules for each component.

---

## 2. Mock Structure Reference

The mock renders each project card as a single `View` with three distinct zones:

```
┌─────────────────────────────────────────────────────────┐
│  HEADER (bg-muted/30, p-5, border-b border-border)       │
│  [Project Name]                  [Pending Payment Badge] │
│  [TrendingUp 16px] Active Project                        │
├─────────────────────────────────────────────────────────┤
│  CONTENT ZONE (p-5)                                      │
│  [Simple View OR Comprehensive View — mutually exclusive]│
├─────────────────────────────────────────────────────────┤
│  TOGGLE BUTTON (py-3 bg-muted/20 border-t border-border) │
│  [View Details / Show Less]  [ChevronDown / ChevronUp]   │
└─────────────────────────────────────────────────────────┘
```

---

## 3. File Change Inventory

| File | Change Type | Summary |
|---|---|---|
| `src/hooks/useProjectsOverview.ts` | Additive | Add 4 fields to `ProjectOverview` |
| `src/components/dashboard/PendingPaymentBadge.tsx` | Style-only | Switch to `chart-3` tokens, add padding |
| `src/pages/dashboard/components/ProjectOverviewCard.tsx` | Full rewrite | Per-card expand state, new header/simple/toggle sections |
| `src/pages/dashboard/components/PhaseProgressRow.tsx` | Style + BLOCKER badge | Bar height, badge colours |
| `src/pages/dashboard/components/TaskIconRow.tsx` | Style + logic | Icon size, truncation, overdue case, colour fixes |
| `src/pages/dashboard/components/AttentionRequiredSection.tsx` | Style-only | Softer red tones matching mock |
| `src/pages/dashboard/index.tsx` | Remove `isComprehensive` | Drop state + toggle, remove prop |

---

## 4. Detailed Changes Per File

---

### 4.1 `useProjectsOverview.ts`

**Add to `ProjectOverview` interface** (after `totalPendingPayment`):

```typescript
totalTasksCount: number;            // all tasks for this project
totalTasksCompleted: number;        // tasks where status === 'completed'
overallStatus: 'on_track' | 'at_risk' | 'blocked';
blockedTasks: Task[];               // tasks where status === 'blocked'
```

**Add to `toOverview()` body** (before the `return`):

```typescript
const totalTasksCount = tasks.length;
const totalTasksCompleted = tasks.filter(t => t.status === 'completed').length;

const blockedTasks = tasks.filter(t => t.status === 'blocked');

// overallStatus derivation (per §3.2 of original design doc)
let overallStatus: 'on_track' | 'at_risk' | 'blocked' = 'on_track';
if (blockedTasks.length > 0) {
  overallStatus = 'blocked';
} else if (overdueCount > 0) {
  overallStatus = 'at_risk';
}
```

**Add fields to the `return` object:**

```typescript
totalTasksCount,
totalTasksCompleted,
overallStatus,
blockedTasks,
```

> No schema or repository changes required — all fields are derived at query time.

---

### 4.2 `PendingPaymentBadge.tsx`

**Style changes only** — no prop changes.

| Property | Before | After |
|---|---|---|
| Background | `bg-orange-500/10` | `bg-chart-3/10` |
| Border | `border border-orange-500/30` | `border border-chart-3/20` |
| Padding | `px-3 py-1.5` | `px-4 py-2` |
| Corner | `rounded-xl` | `rounded-xl` (unchanged) |
| Label text colour | `text-orange-500 dark:text-orange-400` | `text-chart-3` |
| Amount text colour | `text-orange-500 dark:text-orange-400` | `text-chart-3` |
| Label font | `text-[10px] font-bold uppercase` | `text-xs font-medium uppercase` |
| Amount font | `text-base font-bold` | `text-lg font-bold` |

> `chart-3` is the design-system orange/amber token — semantically equivalent to `orange-500`
> but honours theme overrides.

---

### 4.3 `ProjectOverviewCard.tsx` — Full Rewrite

#### Props

```typescript
// REMOVE isComprehensive
interface ProjectOverviewCardProps {
  overview: ProjectOverview;
  onPress: () => void;
}
```

#### Local state

```typescript
const [expanded, setExpanded] = useState(false);
```

#### Status-to-colour helper (inside component)

```typescript
const statusColorClass = {
  on_track: 'bg-green-500',
  at_risk:  'bg-orange-500',
  blocked:  'bg-red-500',
}[overview.overallStatus] ?? 'bg-yellow-500';

const statusLabel = {
  on_track: 'On Track',
  at_risk:  'In Progress',
  blocked:  'Blocked',
}[overview.overallStatus] ?? 'In Progress';
```

#### Render tree

```tsx
<Pressable onPress={onPress}
  className="bg-card border border-border rounded-2xl mb-4 overflow-hidden"
  style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1 })}
>
  {/* ── ZONE 1: Header ── */}
  <View className="p-5 border-b border-border bg-muted/30">
    <View className="flex-row items-start justify-between">
      {/* Left: name + subtitle */}
      <View className="flex-1 pr-4">
        <Text className="text-lg font-bold text-foreground mb-1">
          {project.name}
        </Text>
        <View className="flex-row items-center gap-2">
          <TrendingUp size={16} className="text-primary" />
          <Text className="text-xs text-muted-foreground">Active Project</Text>
        </View>
      </View>
      {/* Right: payment badge */}
      {overview.totalPendingPayment > 0 && (
        <PendingPaymentBadge amount={overview.totalPendingPayment} />
      )}
    </View>
  </View>

  {/* ── ZONE 2a: Simple View (collapsed) ── */}
  {!expanded && (
    <View className="p-5 bg-card">
      <View className="flex-row justify-between items-end mb-2">
        <Text className="text-sm font-semibold text-foreground">Overall Progress</Text>
        <Text className="text-xs font-bold text-muted-foreground">
          {overview.totalTasksCompleted}/{overview.totalTasksCount} tasks
        </Text>
      </View>
      <View className="h-3 bg-muted rounded-full overflow-hidden mb-2">
        <View
          className={`h-full rounded-full ${statusColorClass}`}
          style={{ width: `${overview.progressPercent}%` }}
        />
      </View>
      <View className="flex-row items-center justify-between mt-2">
        <View className="flex-row items-center">
          <View className={`w-2 h-2 rounded-full ${statusColorClass} mr-2`} />
          <Text className="text-xs text-muted-foreground">{statusLabel}</Text>
        </View>
        <Text className="text-xs font-bold text-foreground">
          {overview.progressPercent}%
        </Text>
      </View>
    </View>
  )}

  {/* ── ZONE 2b: Comprehensive View (expanded) ── */}
  {expanded && (
    <View className="p-5 gap-6">
      {overview.phaseOverviews.map(po => (
        <PhaseProgressRow key={po.phaseId ?? 'unassigned'} phaseOverview={po} />
      ))}
    </View>
  )}

  {/* ── ZONE 3: Toggle Button ── */}
  <Pressable
    onPress={() => setExpanded(prev => !prev)}
    className="flex-row items-center justify-center py-3 bg-muted/20 border-t border-border active:bg-muted/40"
  >
    <Text className="text-sm font-medium text-primary mr-2">
      {expanded ? 'Show Less' : 'View Details'}
    </Text>
    {expanded
      ? <ChevronUp size={18} className="text-primary" />
      : <ChevronDown size={18} className="text-primary" />
    }
  </Pressable>
</Pressable>
```

**New imports required:**
```typescript
import { useState } from 'react';
import { TrendingUp, ChevronDown, ChevronUp } from 'lucide-react-native';
import { PendingPaymentBadge } from '../../../components/dashboard/PendingPaymentBadge';
import { PhaseProgressRow } from './PhaseProgressRow';
```

**Remove:**
- `AlertCircle`, `Clock`, `CheckCircle2` icon imports
- `StyleSheet` import
- All old comprehensive-view JSX (task counts, next-critical-task, quick actions)

---

### 4.4 `PhaseProgressRow.tsx`

#### Progress bar height

```tsx
// BEFORE: h-2
// AFTER:  h-2.5
<View className="h-2.5 w-full bg-muted rounded-full overflow-hidden mb-1">
```

#### BLOCKER badge — full replacement

```tsx
// BEFORE
<View className="flex-row items-center bg-background border border-red-500/20 px-2 py-0.5 rounded-sm">
  <AlertTriangle size={12} color="#ef4444" className="mr-1" />
  <Text className="text-red-500 text-[10px] uppercase font-bold tracking-wider">Blocker</Text>
</View>

// AFTER  (matches mock: bg-red-50, AlertTriangle 14px, text-red-600)
<View className="flex-row items-center bg-red-50 px-2 py-1 rounded-md">
  <AlertTriangle className="text-red-500 mr-1" size={14} />
  <Text className="text-red-600 text-xs font-bold">BLOCKER</Text>
</View>
```

No prop or interface changes.

---

### 4.5 `TaskIconRow.tsx`

#### Changes

| Property | Before | After |
|---|---|---|
| Icon circle size | `w-7 h-7` | `w-8 h-8` |
| Icon size | `14` | `12` |
| Gap | `gap-2` | `gap-3` |
| Layout | `flex-wrap` | single row (remove `flex-wrap`) |
| Truncation | none | `tasks.slice(0, 6)` |
| `pending` colour | `bg-orange-500` | `bg-yellow-500` |
| `in_progress` colour | `bg-orange-400` | `bg-yellow-500` |
| `overdue` case | missing | `bg-red-600` + `AlertTriangle` 12px |

#### Updated render logic

```tsx
export function TaskIconRow({ tasks }: TaskIconRowProps) {
  if (!tasks || tasks.length === 0) return null;

  return (
    <View className="flex-row items-center gap-3 mt-3 mb-4">
      {tasks.slice(0, 6).map(task => {
        let bgColor = 'bg-yellow-500';
        let IconComponent: React.ElementType = Clock;
        const iconColor = '#fff';

        if (task.status === 'completed') {
          bgColor = 'bg-green-500';
          IconComponent = Check;
        } else if (task.status === 'blocked') {
          bgColor = 'bg-red-500';
          IconComponent = X;
        } else if (task.status === 'overdue') {
          bgColor = 'bg-red-600';
          IconComponent = AlertTriangle;
        }
        // pending / in_progress → yellow clock (default)

        return (
          <View key={task.id} className={`w-8 h-8 rounded-full items-center justify-center shadow-sm ${bgColor}`}>
            <IconComponent size={12} color={iconColor} strokeWidth={2.5} />
          </View>
        );
      })}
    </View>
  );
}
```

**Add import:** `AlertTriangle` from `lucide-react-native`.

---

### 4.6 `AttentionRequiredSection.tsx`

Style-only changes — no prop or logic changes.

| Property | Before | After |
|---|---|---|
| Container bg | `bg-red-500/10` | `bg-red-50/50` |
| Container border | `border-red-500/20` | `border-red-100` |
| Container corner | `rounded-xl` | `rounded-lg` |
| Title text | `text-red-500 font-bold text-[13px]` | `text-xs text-red-700 font-semibold` |
| Chip bg | `bg-background` | `bg-white/80` |
| Chip border | `border-red-500/30` | `border-red-200` |
| Chip text | `text-red-500 font-medium text-xs` | `text-xs text-red-800` |

---

### 4.7 `DashboardScreen` (`src/pages/dashboard/index.tsx`)

1. **Remove** `isComprehensive` state declaration.
2. **Remove** the `{hasProjects && (...)}` block containing the `LayoutGrid`/`List` toggle.
3. **Remove** `isComprehensive={isComprehensive}` from every `<ProjectOverviewCard />` call.
4. **Remove** `LayoutGrid`, `List` from the `lucide-react-native` import (if no longer used elsewhere).

> The `hasProjects` guard for the toggle was the only use of `LayoutGrid`/`List` — confirm
> neither icon is used elsewhere in the file before removing the import.

---

## 5. Test Acceptance Criteria (Delta from original doc)

The original §6 test criteria remain valid. Additional tests for this refined pass:

### Unit — `toOverview()` new fields

| # | Scenario | Expected |
|---|---|---|
| R1 | Mix of completed/pending/blocked tasks | `totalTasksCount === tasks.length` |
| R2 | 3 of 5 tasks completed | `totalTasksCompleted === 3` |
| R3 | One blocked task | `overallStatus === 'blocked'`, `blockedTasks.length === 1` |
| R4 | No blocked, one overdue critical task | `overallStatus === 'at_risk'` |
| R5 | No blocked, no overdue | `overallStatus === 'on_track'` |

### Component — `ProjectOverviewCard`

| # | Scenario | Expected |
|---|---|---|
| P1 | Initial render | `expanded === false`; "View Details" + ChevronDown visible |
| P2 | Press "View Details" | `expanded === true`; `PhaseProgressRow` rendered per phaseOverview |
| P3 | `totalPendingPayment === 0` | `PendingPaymentBadge` not rendered |
| P4 | `overallStatus === 'blocked'` | Progress bar has class `bg-red-500` |
| P5 | Card `onPress` | Fires `onPress` (navigation), does NOT toggle expand |
| P6 | Two cards on screen | Expanding one card does not affect the other |

### Component — `TaskIconRow`

| # | Scenario | Expected |
|---|---|---|
| T1 | 8 tasks passed | Only 6 icon circles rendered |
| T2 | `overdue` task | `bg-red-600` circle with `AlertTriangle` |
| T3 | `pending` task | `bg-yellow-500` circle with `Clock` |
| T4 | `in_progress` task | `bg-yellow-500` circle with `Clock` |

---

## 6. Open Questions

1. **`overdue` as `TaskStatus`** — `overdue` exists in the mock's local type but the domain
   `Task.status` union is `'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled'`.
   Should `TaskIconRow` treat any future `overdue` value defensively (fallback to yellow clock),
   or should `overdue` be added to the domain type? _Assumption: keep domain type as-is for MVP;
   `TaskIconRow` handles unknown status values with yellow clock fallback._

2. **`progressPercent` in simple view** — the mock uses `health.percent` computed over all tasks.
   The current `ProjectOverview.progressPercent` is computed over critical-path tasks only.
   Should simple view show all-tasks percent? _Assumption: expose `totalTasksCompleted /
   totalTasksCount` as `allTasksPercent` in the hook and use that in the simple view, while
   keeping the critical-path `progressPercent` for the header percentage display._

---

## 7. Handoff

- Label: **Start TDD**
- Agent: **developer**
- Prompt: *"Plan approved. Write failing tests for the refined design per `design/issue-164-dashboard-ui-refined.md`."*
