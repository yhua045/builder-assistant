# Design: Issue #210 — ProjectsPage MVVM Refactor (Phase 1)

**Date:** 2026-04-21  
**Branch:** `issue-210-refactor-observability`  
**Parent audit:** [issue-210-ui-architecture-audit.md](issue-210-ui-architecture-audit.md)  
**Author:** Architect agent  
**mobile-ui review:** UI layout preserved — no visual changes (see §6)

---

## 1. Summary

`src/pages/projects/ProjectsPage.tsx` contains a data transformation leak: an inline
`useMemo` that maps domain `ProjectDetails[]` → application `ProjectCardDto[]` directly
inside the React component. It also owns the `createKey` remount-state and the
`handleProjectPress` navigation callback.

This design extracts all non-rendering logic into a **single View-Model Facade hook**
`useProjectsPage()`, leaving the component as a pure presentation binding.

**No visual changes** — layout, Tailwind classes, icon usage, and `ManualProjectEntry`
remount behaviour are all preserved exactly.

---

## 2. Violation Analysis

### 2.1 Lines of concern in `ProjectsPage.tsx`

| Lines | Violation | Category |
|-------|-----------|----------|
| `import { ProjectCardDto } from '../../application/dtos/ProjectCardDto'` | Application DTO imported in UI | ❌ Layer breach |
| `import { ProjectDetails } from '../../domain/entities/ProjectDetails'` | Domain entity imported in UI | ❌ Layer breach |
| `const projectDtos = useMemo(...)` (7 lines) | Domain→DTO data transformation in UI | ❌ Layer breach |
| `const [createKey, setCreateKey] = useState(0)` | Remount-key state in UI | ⚠️ Poor cohesion |
| `const handleProjectPress = useCallback(...)` | Navigation action in UI | ⚠️ Poor cohesion |

### 2.2 What stays in the UI (acceptable)

| Code | Verdict |
|------|---------|
| `loading` / `error` / empty-state rendering | ✅ Pure presentation |
| `<ProjectCard>`, `<ManualProjectEntry>` JSX | ✅ Component composition |
| `<ScrollView>`, `<SafeAreaView>` layout | ✅ Layout |
| `<Layers>`, `<Plus>` icon renders | ✅ Presentation config |
| `<ThemeToggle />` | ✅ Presentation config |

---

## 3. Target Architecture

```
ProjectsPage (UI — pure presentation binding)
  └── useProjectsPage (View-Model Facade Hook)
        ├── useProjects (data + use case hook — hidden from UI)
        └── useNavigation (React Navigation)
```

### 3.1 Dependency flow

```
UI Layer (ProjectsPage)
  ↓  consumes
Hook Layer (useProjectsPage)
  ↓  delegates data fetching to
Hook Layer (useProjects)
  ↓  uses DI container for
Application Layer (CreateProjectUseCase, GetProjectAnalysisUseCase)
  ↓  resolves
Infrastructure Layer (DrizzleProjectRepository)
```

---

## 4. New Abstraction: `useProjectsPage`

### 4.1 File location

```
src/hooks/useProjectsPage.ts
```

### 4.2 Responsibilities

1. **Data:** Calls `useProjects()` internally; maps raw `ProjectDetails[]` →
   `ProjectCardDto[]` via a pure mapping function `toProjectCardDto`.
2. **State:** Owns the `createKey` counter used to remount `ManualProjectEntry`.
3. **Actions:** Provides `navigateToProject` and `openCreate` (increments key).
4. **Derived:** Exposes `hasProjects` boolean.

### 4.3 TypeScript interface

```typescript
// src/hooks/useProjectsPage.ts

import { ProjectCardDto } from '../application/dtos/ProjectCardDto';

export interface ProjectsPageViewModel {
  // Data
  projectDtos: ProjectCardDto[];
  loading: boolean;
  error: string | null;
  hasProjects: boolean;

  // UI State
  createKey: number;

  // Actions
  openCreate: () => void;
  navigateToProject: (projectId: string) => void;
}

export function useProjectsPage(): ProjectsPageViewModel;
```

### 4.4 Private mapping function

The `ProjectDetails → ProjectCardDto` mapping is extracted as a **module-private pure
function** so it can be independently unit-tested:

```typescript
// within src/hooks/useProjectsPage.ts (not exported)
function toProjectCardDto(project: ProjectDetails): ProjectCardDto {
  return {
    id: project.id,
    owner: project.owner?.name || project.name,
    address: project.property?.address || project.location || 'No Address',
    status: project.status,
    contact: project.owner?.phone || project.owner?.email || 'No contact',
    lastCompletedTask: {
      title: 'Initial Setup',
      completedDate: project.createdAt
        ? new Date(project.createdAt).toLocaleDateString()
        : '-',
    },
    upcomingTasks: project.upcomingTasks,
  };
}
```

> **Note:** `toProjectCardDto` is intentionally NOT exported. It is tested indirectly
> through the hook's output. If the mapping grows complex it can be promoted to
> `src/application/mappers/projectCardDtoMapper.ts` in a future ticket.

### 4.5 Full hook implementation sketch

```typescript
export function useProjectsPage(): ProjectsPageViewModel {
  const { projects, loading, error } = useProjects();
  const navigation = useNavigation<any>();
  const [createKey, setCreateKey] = useState(0);

  const projectDtos = useMemo(
    () => (projects ?? []).map(toProjectCardDto),
    [projects],
  );

  const hasProjects = projectDtos.length > 0;

  const openCreate = useCallback(() => setCreateKey(k => k + 1), []);

  const navigateToProject = useCallback(
    (projectId: string) => navigation.navigate('ProjectDetail', { projectId }),
    [navigation],
  );

  return {
    projectDtos,
    loading,
    error,
    hasProjects,
    createKey,
    openCreate,
    navigateToProject,
  };
}
```

---

## 5. Changes to `ProjectsPage`

### 5.1 Imports removed

```typescript
// DELETE from src/pages/projects/ProjectsPage.tsx:
import { useMemo, useCallback, useState } from 'react'; // all removed
import { useNavigation } from '@react-navigation/native';   // moved to hook
import { useProjects } from '../../hooks/useProjects';       // moved to hook
import { ProjectCardDto } from '../../application/dtos/ProjectCardDto'; // moved to hook
import { ProjectDetails } from '../../domain/entities/ProjectDetails';  // moved to hook
```

### 5.2 Imports added

```typescript
// ADD to src/pages/projects/ProjectsPage.tsx:
import { useProjectsPage } from '../../hooks/useProjectsPage';
```

`React` stays (needed for JSX). `View`, `Text`, `ScrollView`, `ActivityIndicator`,
`Pressable`, `SafeAreaView`, `ProjectCard`, `ManualProjectEntry`, `ThemeToggle`,
`Layers`, `Plus` — all unchanged.

### 5.3 Component body before / after

**Before** (~15 lines of data/state/transformation):
```typescript
const navigation = useNavigation<any>();
const { projects, loading, error } = useProjects();
const [createKey, setCreateKey] = useState(0);

const handleProjectPress = useCallback(
  (project: ProjectCardDto) => {
    navigation.navigate('ProjectDetail', { projectId: project.id });
  },
  [navigation],
);

const projectDtos = useMemo((): ProjectCardDto[] => {
  if (!projects) return [];
  return projects.map((project: ProjectDetails): ProjectCardDto => ({
    /* ... 9 lines of mapping ... */
  }));
}, [projects]);

const hasProjects = (projectDtos?.length ?? 0) > 0;
```

**After** (1 line):
```typescript
const vm = useProjectsPage();
```

### 5.4 JSX binding changes

| Before | After |
|--------|-------|
| `loading` | `vm.loading` |
| `error` | `vm.error` |
| `projectDtos` | `vm.projectDtos` |
| `projectDtos.length === 0` | `!vm.hasProjects` |
| `setCreateKey(k => k + 1)` | `vm.openCreate()` |
| `createKey` | `vm.createKey` |
| `handleProjectPress` | `vm.navigateToProject` (adapted — see note) |

> **Adapter note:** `handleProjectPress` currently receives a full `ProjectCardDto` and
> extracts `project.id`. After refactor, `<ProjectCard onPress>` can pass the id
> directly, or the existing callback signature is preserved inside the hook. Either
> approach is acceptable; keep existing `ProjectCard` API unchanged.

---

## 6. UI Constraints (mobile-ui agent review)

**No visual changes are planned.** Consultation with the `mobile-ui` agent confirms:

- SafeAreaView + ScrollView + `px-6` padding layout: **preserved**.
- `ProjectCard` composition and `onPress` prop contract: **preserved**.
- `ManualProjectEntry` remount-key pattern (`key={vm.createKey}`, `initialVisible={vm.createKey > 0}`): **preserved**.
- Header with `<Layers>`, `<Plus>`, `<ThemeToggle>` row: **preserved**.
- Loading / error / empty-state `testID` attributes: **preserved** (required by existing snapshot tests).

---

## 7. File Change Inventory

| File | Change Type | Summary |
|------|-------------|---------|
| `src/hooks/useProjectsPage.ts` | **New file** | View-Model Facade; encapsulates data query, DTO mapping, `createKey` state, navigation actions |
| `src/pages/projects/ProjectsPage.tsx` | **Refactor** | Consumes single `useProjectsPage()` call; all domain/application/infra imports removed |

---

## 8. TDD Acceptance Criteria

### 8.1 `useProjectsPage` unit tests (`__tests__/unit/hooks/useProjectsPage.test.ts`)

- [ ] Returns `projectDtos: []` and `hasProjects: false` when `useProjects` returns empty array.
- [ ] Correctly maps a `ProjectDetails` fixture → `ProjectCardDto` (all fields: `owner`, `address`, `status`, `contact`, `lastCompletedTask`, `upcomingTasks`).
- [ ] Falls back to `project.name` for `owner` when `project.owner.name` is absent.
- [ ] Falls back to `project.location` for `address` when `property.address` is absent.
- [ ] Falls back to `'No Address'` when both `property.address` and `location` are absent.
- [ ] `createdAt` undefined → `lastCompletedTask.completedDate` is `'-'`.
- [ ] `openCreate()` increments `createKey` by 1 each call.
- [ ] `navigateToProject('proj-1')` calls `navigation.navigate('ProjectDetail', { projectId: 'proj-1' })`.
- [ ] `loading` and `error` pass through from `useProjects`.

### 8.2 `ProjectsPage` unit tests (`__tests__/unit/ProjectsPage.test.tsx`)

Existing tests currently mock `useProjects`. After refactor they **must be updated** to mock `useProjectsPage` instead, since the component no longer calls `useProjects`.

- [ ] Snapshot: loading state (mock `vm.loading = true`, `vm.projectDtos = []`).
- [ ] Snapshot: populated list (mock `vm.projectDtos` with one `ProjectCardDto`).
- [ ] Snapshot: empty state (mock `vm.hasProjects = false`, `vm.loading = false`).
- [ ] Zero `../../application/` or `../../domain/` or `../../infrastructure/` imports exist in the `ProjectsPage.tsx` source file.
- [ ] Zero `../../hooks/useProjects` import exists in the `ProjectsPage.tsx` source file.

---

## 9. Out of Scope

- Changes to `useProjects` internals (DI wiring, use cases, query keys).
- Changes to `ProjectCard` component or its props.
- Changes to `ProjectCardDto` shape.
- Adding pagination or filtering to the projects list.
- Extracting `toProjectCardDto` into a standalone mapper file (defer to future ticket if complexity grows).
