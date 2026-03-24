# Plan — Issue #176: Project Edit Flow

**Date**: 2026-03-24  
**Design doc**: [design/issue-176-project-edit.md](design/issue-176-project-edit.md)  
**Agent handoff label**: Start TDD  
**Next agent**: developer

---

## Summary of Changes

Five independent tracks that can be executed in order after the tests are written:

| Track | What changes | TDD steps |
|---|---|---|
| A | Status badge bug fix in `ProjectCard` | Steps 1–2 |
| B | `location` field persistence fix in `DrizzleProjectRepository` | Steps 3–4 |
| C | `CreateProjectUseCase` address → location fix | Steps 5–6 |
| D | New `UpdateProjectUseCase` + `useUpdateProject` hook + invalidation keys | Steps 7–11 |
| E | UI edit flow (Pencil icon, `ProjectEditScreen`, form props, navigator) | Steps 12–17 |

---

## Step-by-Step TDD Plan

---

### TRACK A — Fix ProjectCard Status Badge

#### Step 1 · Write failing unit tests for `ProjectCard` status badge

**File**: `__tests__/unit/ProjectCard.status.test.tsx` *(new)*

Write one test per status value:

```
for each status in [PLANNING, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED]:
  render <ProjectCard project={{ ...minimalDto, status }} />
  assert the badge text equals the expected label
  assert the badge does NOT show 'On Hold' when status is PLANNING / COMPLETED / CANCELLED
```

Expected labels:
| Status | Expected badge text |
|---|---|
| `planning` | `Planning` |
| `in_progress` | `Active` |
| `on_hold` | `On Hold` |
| `completed` | `Done` |
| `cancelled` | `Cancelled` |

These tests MUST fail on the current `ProjectCard` implementation.

---

#### Step 2 · Implement fix in `ProjectCard.tsx`

Replace the binary ternary at line 68 with a status-to-label map:

```ts
const STATUS_CONFIG: Record<ProjectStatus, { label: string; bgClass: string; textClass: string }> = {
  [ProjectStatus.PLANNING]:    { label: 'Planning',  bgClass: 'bg-chart-4/10', textClass: 'text-chart-4' },
  [ProjectStatus.IN_PROGRESS]: { label: 'Active',    bgClass: 'bg-chart-2/10', textClass: 'text-chart-2' },
  [ProjectStatus.ON_HOLD]:     { label: 'On Hold',   bgClass: 'bg-chart-5/10', textClass: 'text-chart-5' },
  [ProjectStatus.COMPLETED]:   { label: 'Done',      bgClass: 'bg-primary/10',  textClass: 'text-primary' },
  [ProjectStatus.CANCELLED]:   { label: 'Cancelled', bgClass: 'bg-destructive/10', textClass: 'text-destructive' },
};
const statusCfg = STATUS_CONFIG[project.status] ?? STATUS_CONFIG[ProjectStatus.PLANNING];
```

Replace badge JSX to use `statusCfg.label`, `statusCfg.bgClass`, `statusCfg.textClass`.

**Verify**: Re-run Step 1 tests → all green.  
**Verify**: TypeScript check passes.

---

### TRACK B — Fix `location` Field Persistence in `DrizzleProjectRepository`

#### Step 3 · Write failing integration test for `location` round-trip

**File**: `__tests__/integration/DrizzleProjectRepository.integration.test.ts`  
*(Extend the existing test file.)*

Add two new test cases:

```
it('save() persists and reads back project.location')
  create a project with location = '42 Wallaby Way, Sydney NSW 2000'
  call repository.save(project)
  const loaded = await repository.findById(project.id)
  expect(loaded.location).toBe('42 Wallaby Way, Sydney NSW 2000')

it('update() persists updated location')
  create + save a project (location = 'Old Address')
  mutate project.location = 'New Address'
  call repository.save(project) again (triggers update path)
  const loaded = await repository.findById(project.id)
  expect(loaded.location).toBe('New Address')
```

These MUST fail because `location` is not in the INSERT/UPDATE SQL.

---

#### Step 4 · Fix `DrizzleProjectRepository` SQL and mapper

**File**: `src/infrastructure/repositories/DrizzleProjectRepository.ts`

Three places to update:

1. **`save()` INSERT** — add `location`, `fire_zone`, `regulatory_flags` to columns and values list.
2. **`update()` UPDATE** — add `location = ?, fire_zone = ?, regulatory_flags = ?` to SET clause.
3. **`mapRowToProject()`** — add:
   ```ts
   location: row.location ?? undefined,
   fireZone: row.fire_zone ?? undefined,
   regulatoryFlags: row.regulatory_flags ? JSON.parse(row.regulatory_flags) : undefined,
   ```
4. **`withTransaction txRepo.save()`** — add the same fields to the UPSERT SQL inside the transaction helper.

**Verify**: Step 3 tests → green.  
**Verify**: Existing `DrizzleProjectRepository` integration tests unchanged → green.

---

### TRACK C — Fix `CreateProjectUseCase` Address → Location Mapping

#### Step 5 · Write failing unit test

**File**: `__tests__/unit/CreateProjectUseCase.test.ts` *(extend)*

Add a test case:

```
it('stores request.address as project.location, not propertyId')
  const mockRepo = { save: jest.fn(), list: jest.fn().mockResolvedValue({ items: [] }), ... }
  const useCase = new CreateProjectUseCase(mockRepo)
  await useCase.execute({ name: 'Test Project', address: '5 Main St, Melbourne VIC 3000' })
  const savedProject = mockRepo.save.mock.calls[0][0]
  expect(savedProject.location).toBe('5 Main St, Melbourne VIC 3000')
  expect(savedProject.propertyId).toBeUndefined()
```

This MUST fail.

---

#### Step 6 · Fix `CreateProjectUseCase`

**File**: `src/application/usecases/project/CreateProjectUseCase.ts`

Change:
```ts
export interface CreateProjectRequest {
  // ...
  address?: string; // propertyId  ← wrong comment, wrong use
  propertyId?: string;             // NEW: explicit FK if ever needed
```

In `execute()`, change:
```ts
// BEFORE
propertyId: request.address,

// AFTER
location: request.address,
propertyId: request.propertyId,
```

**Verify**: Step 5 test → green.  
**Verify**: Existing `CreateProjectUseCase` integration tests unchanged → green.

---

### TRACK D — New UpdateProjectUseCase, Invalidation Key, and Hook

#### Step 7 · Write failing unit tests for `UpdateProjectUseCase`

**File**: `__tests__/unit/UpdateProjectUseCase.test.ts` *(new)*

Test cases:

```
describe('UpdateProjectUseCase')

  it('returns success: false when project not found')
    mockRepo.findById returns null
    result = await useCase.execute({ projectId: 'x', name: 'Y' })
    expect(result.success).toBe(false)

  it('returns success: false when name is empty')
    result = await useCase.execute({ projectId: 'p1', name: '  ' })
    expect(result.success).toBe(false)
    expect(result.errors).toContain('Project name is required')

  it('returns success: false when end date ≤ start date')
    result = await useCase.execute({
      projectId: 'p1', name: 'X',
      startDate: new Date('2026-01-10'),
      expectedEndDate: new Date('2026-01-05'),
    })
    expect(result.success).toBe(false)

  it('persists updated fields via repository.save()')
    result = await useCase.execute({
      projectId: 'p1', name: 'New Name',
      location: 'New Address',
      budget: 500_000,
    })
    const saved = mockRepo.save.mock.calls[0][0]
    expect(saved.name).toBe('New Name')
    expect(saved.location).toBe('New Address')
    expect(saved.budget).toBe(500_000)

  it('does NOT change status, ownerId, phases, or materials')
    originalProject = { status: 'in_progress', ownerId: 'c1', phases: [...], materials: [...] }
    await useCase.execute({ projectId: 'p1', name: 'X' })
    const saved = mockRepo.save.mock.calls[0][0]
    expect(saved.status).toBe('in_progress')
    expect(saved.ownerId).toBe('c1')
    expect(saved.phases).toEqual(originalProject.phases)
    expect(saved.materials).toEqual(originalProject.materials)

  it('sets updatedAt to current time')
    const before = Date.now()
    await useCase.execute({ projectId: 'p1', name: 'X' })
    const saved = mockRepo.save.mock.calls[0][0]
    expect(saved.updatedAt.getTime()).toBeGreaterThanOrEqual(before)
```

---

#### Step 8 · Implement `UpdateProjectUseCase`

**File**: `src/application/usecases/project/UpdateProjectUseCase.ts` *(new)*

```ts
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

export class UpdateProjectUseCase {
  constructor(private readonly projectRepository: ProjectRepository) {}

  async execute(request: UpdateProjectRequest): Promise<UpdateProjectResponse> {
    // 1. fetch
    const project = await this.projectRepository.findById(request.projectId);
    if (!project) return { success: false, errors: ['Project not found'] };

    // 2. validate
    if (!request.name?.trim()) return { success: false, errors: ['Project name is required'] };
    if (request.startDate && request.expectedEndDate && request.startDate >= request.expectedEndDate)
      return { success: false, errors: ['End date must be after start date'] };

    // 3. merge (preserve immutable fields)
    const updated: Project = {
      ...project,
      name: request.name.trim(),
      description: request.description ?? project.description,
      location: request.location ?? project.location,
      startDate: request.startDate ?? project.startDate,
      expectedEndDate: request.expectedEndDate ?? project.expectedEndDate,
      budget: request.budget ?? project.budget,
      currency: request.currency ?? project.currency,
      fireZone: request.fireZone ?? project.fireZone,
      updatedAt: new Date(),
    };

    // 4. persist
    await this.projectRepository.save(updated);
    return { success: true };
  }
}
```

**Verify**: Step 7 tests → green.  
**Verify**: TypeScript check passes.

---

#### Step 9 · Add `projectEdited` invalidation entry

**File**: `src/hooks/queryKeys.ts`

Add context type:
```ts
export type ProjectEditCtx = { projectId: string };
```

Add to `invalidations`:
```ts
/**
 * Edit project fields (name, location, dates, budget, etc.).
 * Affects: project list, project overview cards, hydrated detail.
 */
projectEdited: (ctx: ProjectEditCtx) => [
  queryKeys.projects(),
  queryKeys.projectsOverview(),
  queryKeys.projectDetail(ctx.projectId),
],
```

---

#### Step 10 · Write failing unit test for `useUpdateProject`

**File**: `__tests__/unit/useUpdateProject.test.ts` *(new)*

```
it('calls UpdateProjectUseCase.execute and then invalidates correct query keys')
  mock UpdateProjectUseCase to return { success: true }
  mock queryClient.invalidateQueries
  const { updateProject } = renderHook(() => useUpdateProject()).result.current
  await act(() => updateProject({ projectId: 'p1', name: 'X' }))
  expect queryClient.invalidateQueries called with queryKeys.projects()
  expect queryClient.invalidateQueries called with queryKeys.projectsOverview()
  expect queryClient.invalidateQueries called with queryKeys.projectDetail('p1')

it('returns errors without invalidating when use case fails')
  mock UpdateProjectUseCase to return { success: false, errors: ['Project not found'] }
  const result = await updateProject({ projectId: 'x', name: 'Y' })
  expect(result.success).toBe(false)
  expect queryClient.invalidateQueries not called
```

---

#### Step 11 · Implement `useUpdateProject`

**File**: `src/hooks/useUpdateProject.ts` *(new)*

```ts
export function useUpdateProject(): UseUpdateProjectReturn {
  const queryClient = useQueryClient();
  const repository = useMemo(() => container.resolve<ProjectRepository>('ProjectRepository'), []);
  const useCase = useMemo(() => new UpdateProjectUseCase(repository), [repository]);
  const [loading, setLoading] = useState(false);

  const updateProject = useCallback(async (request: UpdateProjectRequest) => {
    setLoading(true);
    try {
      const result = await useCase.execute(request);
      if (result.success) {
        await Promise.all(
          invalidations.projectEdited({ projectId: request.projectId })
            .map(key => queryClient.invalidateQueries({ queryKey: key })),
        );
      }
      return result;
    } finally {
      setLoading(false);
    }
  }, [useCase, queryClient]);

  return { updateProject, loading };
}
```

**Verify**: Step 10 tests → green.

---

### TRACK E — UI: Edit Icon, EditScreen, Form Props, Navigator

#### Step 12 · Add `excludeCriticalTasks` and `initialValues` props to `ManualProjectEntryForm`

**File**: `src/components/ManualProjectEntryForm.tsx`

Add to `Props` interface:
```ts
excludeCriticalTasks?: boolean;
initialValues?: {
  name?: string;
  address?: string;
  description?: string;
  startDate?: Date | null;
  endDate?: Date | null;
  budget?: string;
  projectType?: string;
  state?: string;
  notes?: string;
};
```

Behaviour changes:
- When `excludeCriticalTasks=true`: the "Step 2 of 2" critical path block is never reached; skip `setFormStep('tasks')` (keep the `useEffect` on `projectId` inert when this prop is true).
- When `initialValues` is provided: initialise each `useState` with the corresponding value *on first render* (use `initialValues` as the default values).

⚠ These two props should NOT break any existing `ManualProjectEntryForm` usage — both are optional and default to existing behaviour.

---

#### Step 13 · Write failing integration tests for `ProjectEditScreen`

**File**: `__tests__/integration/ProjectEditScreen.integration.test.tsx` *(new)*

```
beforeEach:
  mock useProjectDetail to return sampleProject
  mock useUpdateProject to return { updateProject: mockUpdateProject, loading: false }
  mock navigation.navigate / goBack

it('renders with project name pre-filled')
  render <ProjectEditScreen route={{ params: { projectId: 'p1' } }} />
  expect TextInput with value 'Smith Residence' // sampleProject.name

it('renders with address pre-filled from project.location')
  expect TextInput with value sampleProject.location

it('does NOT render critical tasks step (step 2)')
  render the screen
  expect('Step 2 of 2').not.toBeVisible()  // or query returns null

it('tapping Save calls updateProject with correct payload')
  change name to 'New Name'
  tap Save
  expect(mockUpdateProject).toHaveBeenCalledWith(expect.objectContaining({
    projectId: 'p1',
    name: 'New Name',
  }))

it('on successful save, calls navigation.goBack()')
  mockUpdateProject resolves { success: true }
  tap Save
  await ...
  expect(navigation.goBack).toHaveBeenCalled()

it('on failed save, shows Alert with error message')
  mockUpdateProject resolves { success: false, errors: ['Project not found'] }
  tap Save
  await ...
  expect Alert.alert called with error message
```

---

#### Step 14 · Implement `ProjectEditScreen`

**File**: `src/pages/projects/ProjectEditScreen.tsx` *(new)*

```tsx
export default function ProjectEditScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { projectId } = route.params as { projectId: string };
  const { project, loading } = useProjectDetail(projectId);
  const { updateProject } = useUpdateProject();

  const initialValues = project ? {
    name: project.name,
    address: project.location,   // location → address in the form
    description: project.description,
    startDate: project.startDate ?? null,
    endDate: project.expectedEndDate ?? null,
    budget: project.budget != null ? String(project.budget) : '',
    notes: typeof project.meta?.notes === 'string' ? project.meta.notes : '',
  } : undefined;

  const handleSave = async (formData: any) => {
    const result = await updateProject({
      projectId,
      name: formData.name,
      description: formData.description,
      location: formData.address,
      startDate: formData.startDate ?? undefined,
      expectedEndDate: formData.expectedEndDate ?? undefined,
      budget: formData.budget ? parseFloat(formData.budget) : undefined,
    });
    if (result.success) {
      navigation.goBack();
    } else {
      Alert.alert('Error', result.errors?.join('\n') ?? 'Could not save project');
    }
  };

  if (loading || !project) {
    return <ActivityIndicator />;
  }

  return (
    <ManualProjectEntryForm
      visible={true}
      onSave={handleSave}
      onCancel={() => navigation.goBack()}
      criticalPathHook={/* pass a no-op hook */}
      projectId={projectId}
      excludeCriticalTasks={true}
      initialValues={initialValues}
    />
  );
}
```

**Verify**: Step 13 tests → green.

---

#### Step 15 · Add pencil icon to `ProjectDetail` header

**File**: `src/pages/projects/ProjectDetail.tsx`

1. Import `Pencil` from `lucide-react-native` and `cssInterop` it.
2. In `renderListHeader`, add a `Pencil` `Pressable` button alongside (or replacing the empty space next to) the status badge:

```tsx
<Pressable
  testID="project-edit-button"
  onPress={() => navigation.navigate('ProjectEdit', { projectId })}
  className="p-2 -mr-2"
>
  <Pencil className="text-muted-foreground" size={20} />
</Pressable>
```

3. Add a test assertion to the existing `ProjectDetail.integration.test.tsx`:
```
it('renders pencil edit button in header')
  render <ProjectDetailScreen />
  expect(getByTestId('project-edit-button')).toBeTruthy()

it('tapping pencil navigates to ProjectEdit with projectId')
  fireEvent.press(getByTestId('project-edit-button'))
  expect(mockNavigate).toHaveBeenCalledWith('ProjectEdit', { projectId: 'proj-1' })
```

---

#### Step 16 · Register `ProjectEdit` route in `ProjectsNavigator`

**File**: `src/pages/projects/ProjectsNavigator.tsx`

```ts
// Add to type
ProjectEdit: { projectId: string };

// Add Stack.Screen
<Stack.Screen
  name="ProjectEdit"
  component={ProjectEditScreen}
  options={{ presentation: 'modal' }}
/>
```

---

#### Step 17 · End-to-end smoke test (integration)

**File**: `__tests__/integration/ProjectEditFlow.integration.test.tsx` *(new)*  
*(Optional, lower priority — can be added in code review phase.)*

With in-memory repo:
```
1. Create project via CreateProjectUseCase → verify location saved
2. Update project via UpdateProjectUseCase (new name, new location)
3. findDetailsById → verify updated name and location
4. Verify original status / ownerId / phases unchanged
```

---

## Execution Order

```
┌─────────────────────────────────────────────┐
│ Step 1-2  ← ProjectCard status badge        │ (independent, quick win)
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ Step 3-4  ← Repository location persistence │ (prerequisite for E)
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ Step 5-6  ← CreateProjectUseCase fix        │ (small, independent)
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ Step 7-11 ← UpdateProjectUseCase + hook     │ (prerequisite for E)
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ Step 12-16 ← UI edit flow                   │ (depends on all above)
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ Step 17  ← End-to-end smoke test (optional) │
└─────────────────────────────────────────────┘
```

---

## Invariants (Must Never Break)

- All existing integration tests MUST stay green throughout.  
- `ManualProjectEntryForm` with no extra props retains current 2-step behaviour.  
- `CreateProjectUseCase` duplicate-check logic (address + ownerId) still functions; since `address` now maps to `location`, the duplicate check on `propertyId + ownerId` should be updated or removed (it was based on the incorrect mapping anyway — address is now a free-text field, not a FK).
- `ProjectValidationService.validateStatusTransition` is unchanged — `UpdateProjectUseCase` does NOT change status.
- TypeScript strict mode must pass (`npx tsc --noEmit`) after every step.

---

## Open Questions

- Should `CreateProjectUseCase`'s duplicate-check be dropped now that `address` maps to free-text `location` (not a FK `propertyId`)? — **Recommended**: yes, remove that check. It was semantically wrong. Track in follow-up issue.
- Should `ProjectEditScreen` allow editing `status` (with workflow validation)? — **Out of scope for #176** per requirements ("exclude critical tasks step only").
- Do we need geocoding on save (lat/lng from text address)? — **Out of scope**, tracked via issue #96.

---

## Handoff

> **Label**: Start TDD  
> **Agent**: developer  
> **Prompt**: "Plan approved. Write failing tests for these requirements, following the test cases in `design/issue-176-project-edit.md` and the step sequence in `plan.md`. Start with Track A (Steps 1–2: ProjectCard status badge), verify red-green cycle, then proceed."
