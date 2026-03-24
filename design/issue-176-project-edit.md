# Issue #176 — Project Edit Flow

**Date**: 2026-03-24  
**Status**: Design / Plan  
**Branch**: `feature-issue-176-project-edit`

---

## 1. User Stories

- As a user, I can tap a pencil icon in the Project Detail header to open a full-screen edit flow for the project.
- As a user, I can edit all project fields (name, address/location, dates, budget, description, status) without re-running the Critical Tasks selection step.
- As a user, the Project Detail screen always shows my project's site address.
- As a user, the Project Card's status badge shows the correct label for every status (Planning, Active, On Hold, Completed, Cancelled).
- My edits are immediately visible on the Project Card, Project List, and Project Detail after saving.

---

## 2. Investigation Findings

### 2.1 Status Mapping Bug — `ProjectCard.tsx`

**File**: `src/components/ProjectCard.tsx` (line 68)

```tsx
{project.status === ProjectStatus.IN_PROGRESS ? 'Active' : 'On Hold'}
```

**Bug**: Binary ternary — every status that is NOT `IN_PROGRESS` is shown as "On Hold".  
This means `PLANNING`, `COMPLETED`, and `CANCELLED` projects all display "On Hold".

**Fix**: Replace with a multi-case status map:
```
PLANNING    → 'Planning' (muted badge)
IN_PROGRESS → 'Active'   (green badge)
ON_HOLD     → 'On Hold'  (amber badge)
COMPLETED   → 'Done'     (blue badge)
CANCELLED   → 'Cancelled'(red badge)
```

---

### 2.2 `location` Field Never Persisted — `DrizzleProjectRepository`

**Schema** (`src/infrastructure/database/schema.ts`): `location TEXT` column **exists**.

**Bug**: `DrizzleProjectRepository.save()` INSERT SQL and `update()` UPDATE SQL  
both omit `location`, `fire_zone`, `regulatory_flags`. The `mapRowToProject()`  
private method also never reads these columns back.

Effect: even if `project.location` is non-null after entity creation, it is  
silently dropped on every save and never hydrated on read.

**Fix**: Add `location`, `fire_zone`, `regulatory_flags` to INSERT, UPDATE, and  
`mapRowToProject`.

---

### 2.3 Form Address Not Saved to `project.location`

**File**: `src/application/usecases/project/CreateProjectUseCase.ts`

The `CreateProjectRequest.address` field has this comment:
```ts
address?: string; // propertyId
```
It is fed into `ProjectEntity.create({ propertyId: request.address, ... })`.

But `ManualProjectEntryForm` treats `address` as a **free-text postal address** (labelled "Address *", required validation). The intent is to populate `project.location` — the human-readable site address string — not a foreign-key property ID.

**Fix**: In `CreateProjectUseCase`, route `request.address` → `location:` instead of `propertyId:`.  
(A proper property FK can be wired separately via `request.propertyId` if ever needed.)

---

### 2.4 No general `UpdateProjectUseCase`

Only `UpdateProjectStatusUseCase` exists. No use case handles editing core project  
fields (name, description, location, dates, budget).

**Fix**: Create `src/application/usecases/project/UpdateProjectUseCase.ts`.

---

### 2.5 No Edit Flow in UI

- `ProjectDetail.tsx` — no pencil/Edit icon in header
- No `ProjectEditScreen` component
- `ProjectsNavigator` has no `ProjectEdit` route
- `ManualProjectEntryForm` has no `excludeCriticalTasks` or `initialValues` props

**Fix**: Add all of the above (see Implementation Plan below).

---

### 2.6 ProjectDetail Already Has Address Display

`ProjectDetail.tsx` already renders `project.location` with a `<MapPin>` icon.  
This will work correctly once findings 2.2 & 2.3 are fixed.

---

## 3. Domain Model Snapshot (Relevant Fields)

```
Project
  id: string
  name: string                 ← editable
  description?: string         ← editable
  location?: string            ← editable (free-text site address)
  status: ProjectStatus        ← editable (workflow-validated transitions)
  startDate?: Date             ← editable
  expectedEndDate?: Date       ← editable
  budget?: number              ← editable
  currency?: string            ← editable
  fireZone?: string            ← editable (optional)
  ownerId?: string             ← NOT editable in this issue
  propertyId?: string          ← NOT editable in this issue
  phases, materials            ← carried through unchanged on edit
```

---

## 4. Interfaces / Contracts

### 4.1 UpdateProjectUseCase

```ts
// src/application/usecases/project/UpdateProjectUseCase.ts

export interface UpdateProjectRequest {
  projectId: string;
  name: string;
  description?: string;
  location?: string;
  startDate?: Date;
  expectedEndDate?: Date;
  budget?: number;
  currency?: string;
  fireZone?: string;
}

export interface UpdateProjectResponse {
  success: boolean;
  errors?: string[];
}
```

### 4.2 `ManualProjectEntryForm` prop additions

```ts
interface Props {
  // existing ...
  excludeCriticalTasks?: boolean;     // NEW — skip step 2 (task selection)
  initialValues?: ProjectFormValues;  // NEW — pre-fill for edit mode
}

interface ProjectFormValues {
  name?: string;
  address?: string;
  description?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  budget?: string;
  projectType?: string;
  state?: string;
  notes?: string;
}
```

### 4.3 `queryKeys` invalidation entry (NEW)

```ts
projectEdited: (ctx: { projectId: string }) => [
  queryKeys.projects(),
  queryKeys.projectsOverview(),
  queryKeys.projectDetail(ctx.projectId),
]
```

### 4.4 `useUpdateProject` hook (NEW)

```ts
// src/hooks/useUpdateProject.ts
export interface UseUpdateProjectReturn {
  updateProject: (request: UpdateProjectRequest) => Promise<{ success: boolean; errors?: string[] }>;
  loading: boolean;
}
export function useUpdateProject(): UseUpdateProjectReturn;
```

### 4.5 Navigation Shape (NEW route)

```ts
// ProjectsStackParamList addition
ProjectEdit: { projectId: string };
```

---

## 5. Acceptance Criteria (Test Checklist)

### Unit tests (`__tests__/unit/`)

- [ ] `UpdateProjectUseCase` — validates name is non-empty  
- [ ] `UpdateProjectUseCase` — validates end date > start date  
- [ ] `UpdateProjectUseCase` — persists updated fields via repository `save()`  
- [ ] `UpdateProjectUseCase` — leaves `phases`, `materials`, `status`, `ownerId` unchanged  
- [ ] `UpdateProjectUseCase` — returns `success: false` when project not found  

- [ ] `CreateProjectUseCase` — `request.address` is stored as `project.location`, not `project.propertyId`  

- [ ] `ProjectCard` — renders "Planning" badge for `PLANNING` status  
- [ ] `ProjectCard` — renders "Active" badge for `IN_PROGRESS` status  
- [ ] `ProjectCard` — renders "On Hold" badge for `ON_HOLD` status  
- [ ] `ProjectCard` — renders "Done" badge for `COMPLETED` status  
- [ ] `ProjectCard` — renders "Cancelled" badge for `CANCELLED` status  

### Integration tests (`__tests__/integration/`)

- [ ] `DrizzleProjectRepository` — `save()` persists `location` and reads it back  
- [ ] `DrizzleProjectRepository` — `update()` (via second `save()` call) persists updated `location`  
- [ ] `UpdateProjectUseCase` + In-memory repo — round-trip edit preserves unchanged fields  

### Integration (UI) tests (`__tests__/integration/`)

- [ ] `ProjectDetail` — edit icon (Pencil) renders in header  
- [ ] `ProjectDetail` — tapping pencil navigates to `ProjectEdit` with `projectId`  
- [ ] `ProjectDetail` — renders `location` field with MapPin when `project.location` is set  
- [ ] `ProjectEditScreen` — pre-fills form with existing project values  
- [ ] `ProjectEditScreen` — step 2 (critical tasks) is never shown (`excludeCriticalTasks=true`)  
- [ ] `ProjectEditScreen` — saving calls `updateProject`, invalidates queries, pops back  

---

## 6. Component / File Map

| Layer | File | Change |
|---|---|---|
| Domain | `src/domain/entities/Project.ts` | None needed |
| Application | `src/application/usecases/project/UpdateProjectUseCase.ts` | **CREATE** |
| Application | `src/application/usecases/project/CreateProjectUseCase.ts` | Fix `address → location` |
| Infrastructure | `src/infrastructure/repositories/DrizzleProjectRepository.ts` | Fix INSERT, UPDATE, `mapRowToProject` for `location`/`fireZone`/`regulatoryFlags` |
| Hooks | `src/hooks/queryKeys.ts` | Add `projectEdited` invalidation |
| Hooks | `src/hooks/useUpdateProject.ts` | **CREATE** |
| Components | `src/components/ManualProjectEntryForm.tsx` | Add `excludeCriticalTasks`, `initialValues` props |
| Components | `src/components/ProjectCard.tsx` | Fix multi-status badge |
| Pages | `src/pages/projects/ProjectEditScreen.tsx` | **CREATE** |
| Pages | `src/pages/projects/ProjectsNavigator.tsx` | Add `ProjectEdit` route |
| Pages | `src/pages/projects/ProjectDetail.tsx` | Add pencil icon → navigate to `ProjectEdit` |

---

## 7. Migration Note

`location`, `fire_zone`, `regulatory_flags` columns already exist in the schema  
(added in issue #125). No Drizzle migration is required. Only the repository  
SQL statements need updating.
