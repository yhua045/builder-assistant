# Design: Issue #195 — Create Task for Quotation + Approve Action + Task Detail Linking

**Status**: DRAFT — Awaiting LGTB Approval  
**Author**: Architect Agent (reviewed with mobile-ui agent)  
**Date**: 2026-04-09  
**GitHub Issue**: #195  
**Branch**: `feature-195-create-task-for-quotation`

---

## 1. User Stories

1. **Auto-linked Task**: As a builder, when I log a quotation, a corresponding Task is automatically created and linked to the same Project, so I can track the work in my task list.
2. **Required Project field**: As a builder, I cannot save a quotation without selecting a Project, so all quotations are always associated to a project.
3. **Approve/Cancel actions**: As a builder, when I view a quotation that is awaiting my decision (`pending_approval`), I see clear **Approve** and **Cancel** buttons so I can either accept it (and generate an invoice) or reject it.
4. **Task Detail linking**: As a builder, on the Task Detail screen I can see if a linked quotation exists, its current approval status, and navigate directly to the quotation detail to take action.

---

## 2. Acceptance Criteria

| # | Criterion |
|---|-----------|
| AC-1 | When a quotation is created via `CreateQuotationWithTaskUseCase`, a Task is also created with `projectId = quotation.projectId` and `taskId` is written back to `quotation.taskId`. |
| AC-2 | `CreateQuotationWithTaskUseCase` throws `QUOTATION_PROJECT_REQUIRED` if `projectId` is absent or empty. |
| AC-3 | The auto-created task has `title = "Review Quotation: {vendorName ?? reference}"`, `status = 'pending'`, `taskType = 'contract_work'`, `quoteStatus = 'issued'`, and `quoteAmount = quotation.total`. |
| AC-4 | `QuotationForm` shows a required indicator (*) on the Project field and blocks submission with a validation error when no project is selected. |
| AC-5 | Quotation entity supports `'pending_approval'` status. The Drizzle schema and migration are updated accordingly (SQLite text column, `NOT NULL` enum). |
| AC-6 | `QuotationDetail` screen shows **Cancel** and **Approve** buttons when `quotation.status === 'pending_approval'`. |
| AC-7 | Tapping **Approve** invokes `ApproveQuotationUseCase` (validates `pending_approval`; creates `Invoice`; sets quotation status → `'accepted'`; if `quotation.taskId` is set, updates `task.quoteStatus → 'accepted'` and `task.quoteInvoiceId`). |
| AC-7b| Tapping **Cancel** invokes `DeclineQuotationUseCase` (validates `pending_approval`; sets quotation status → `'declined'`; if `quotation.taskId` is set, updates `task.quoteStatus → 'declined'`). |
| AC-8 | On success, `QuotationDetail` replaces the buttons with an `Accepted` or `Declined` badge and navigates (or shows confirmation). |
| AC-9 | `GetTaskDetailUseCase` returns `linkedQuotations: Quotation[]` populated via `QuotationRepository.findByTask(taskId)`. |
| AC-10 | `TaskDetailsPage` renders a `TaskLinkedQuotationSection` when `taskDetail.linkedQuotations` is non-empty. |
| AC-11 | `TaskLinkedQuotationSection` shows a **yellow "Pending Approval" banner** with an "Open Quotation" link when any linked quotation is `pending_approval`. |
| AC-12 | `TaskLinkedQuotationSection` shows a **green "Approved" row** with quotation total for `accepted` quotations. |
| AC-13 | All new and modified use cases have unit tests; all new and modified UI components have unit tests. |
| AC-14 | Two integration tests: `CreateQuotationWithTask` flow (Drizzle) and `ApproveQuotation` flow (Drizzle). |
| AC-15 | `npx tsc --noEmit` passes. |

---

## 3. Current State Analysis

| Concern | Current State | Gap |
|---------|---------------|-----|
| `Quotation` entity status | `'draft' \| 'sent' \| 'accepted' \| 'declined'` | Must add `'pending_approval'` |
| `quotations` DB schema | `enum: ['draft','sent','accepted','declined']` | Drizzle schema update + migration needed |
| `CreateQuotationUseCase` | Single-responsibility: creates quotation record only | Cannot create linked task — new orchestration use case required |
| `QuotationForm` project field | Picker exists (from #192) but project is optional | Add `required` validation guard in form validate() |
| `Approve/Decline UseCases`| Do not exist | New use cases needed for approving and declining |
| `GetTaskDetailUseCase` | Returns `TaskDetail` (deps, delays, logs) | Does not include `linkedQuotations`; needs `QuotationRepository` injection |
| `TaskDetail` interface | `{ dependencyTasks, delayReasons, progressLogs }` | Add `linkedQuotations: Quotation[]` |
| `TaskDetailsPage` | Renders `TaskQuotationSection` for task-level quote fields only | Does not show linked `Quotation` records |
| `TaskLinkedQuotationSection` | Does not exist | New component needed |
| `QuotationDetail` screen | Read-only, no action buttons | Add Approve and Cancel buttons for `pending_approval` status |
| `useQuotations` hook | Has `createQuotation` / `updateQuotation` etc. | Needs `approveQuotation` and `declineQuotation` actions |

---

## 4. Domain Changes

### 4.1 `Quotation` entity (`src/domain/entities/Quotation.ts`)

Add `'pending_approval'` to the status union:

```typescript
status: 'draft' | 'sent' | 'pending_approval' | 'accepted' | 'declined';
```

Update `STATUS_CONFIG` in `QuotationDetail.tsx` accordingly:

```typescript
pending_approval: { label: 'Pending Approval', bgClass: 'bg-yellow-100', textClass: 'text-yellow-700' },
```

### 4.2 DB Schema (`src/infrastructure/database/schema.ts`)

```typescript
status: text('status', {
  enum: ['draft', 'sent', 'pending_approval', 'accepted', 'declined']
}).notNull().default('draft'),
```

Run `npm run db:generate` to produce the migration. No data migration needed (existing rows remain valid).

---

## 5. Application Layer

### 5.1 `CreateQuotationWithTaskUseCase` (new)

**File**: `src/application/usecases/quotation/CreateQuotationWithTaskUseCase.ts`

**Responsibilities**:
1. Validate `projectId` is present → throw `QUOTATION_PROJECT_REQUIRED`
2. Create `Task` via `TaskRepository.save()` with fields derived from quotation
3. Call `QuotationRepository.createQuotation()` with `taskId` set and `status: 'pending_approval'`
4. Return `{ quotation, task }`

**Constructor deps**: `QuotationRepository`, `TaskRepository`

```typescript
export interface CreateQuotationWithTaskInput {
  quotation: Omit<Quotation, 'id' | 'createdAt' | 'updatedAt' | 'taskId' | 'status'>;
}

export interface CreateQuotationWithTaskOutput {
  quotation: Quotation;
  task: Task;
}
```

**Task auto-creation rules**:
- `title`: `"Review Quotation: ${vendorName ?? reference}"`
- `status`: `'pending'`
- `taskType`: `'contract_work'`
- `quoteStatus`: `'issued'`
- `quoteAmount`: `quotation.total`
- `projectId`: `quotation.projectId`

### 5.2 `ApproveQuotationUseCase` & `DeclineQuotationUseCase` (new)

**File**: `src/application/usecases/quotation/ApproveQuotationUseCase.ts`

**Responsibilities**:
1. Load quotation → throw `QUOTATION_NOT_FOUND` if missing
2. Guard: status must be `'pending_approval'` → throw `QUOTATION_NOT_PENDING_APPROVAL`
3. Create invoice from quotation data (mirrors `AcceptStandaloneQuotationUseCase`)
4. Update quotation: `status = 'accepted'`, `updatedAt = now`
5. If `quotation.taskId` is set: update task `quoteStatus = 'accepted'`, `quoteInvoiceId = invoice.id`

**Constructor deps**: `InvoiceRepository`, `QuotationRepository`, `TaskRepository`

```typescript
export interface ApproveQuotationInput {
  quotationId: string;
}
export interface ApproveQuotationOutput {
  invoice: Invoice;
  quotation: Quotation;
  task?: Task; // populated if quotation.taskId was set
}
```

**File**: `src/application/usecases/quotation/DeclineQuotationUseCase.ts`

**Responsibilities**:
1. Load quotation → throw `QUOTATION_NOT_FOUND` if missing
2. Guard: status must be `'pending_approval'` → throw `QUOTATION_NOT_PENDING_APPROVAL`
3. Update quotation: `status = 'declined'`, `updatedAt = now`
4. If `quotation.taskId` is set: update task `quoteStatus = 'declined'`

**Constructor deps**: `QuotationRepository`, `TaskRepository`

### 5.3 `GetTaskDetailUseCase` (extend)

**File**: `src/application/usecases/task/GetTaskDetailUseCase.ts`

Extend `TaskDetail` and hydrate `linkedQuotations` in parallel with existing fetches:

```typescript
export interface TaskDetail extends Task {
  dependencyTasks: Task[];
  delayReasons: DelayReason[];
  progressLogs: ProgressLog[];
  linkedQuotations: Quotation[];          // NEW
}
```

Constructor gains optional `QuotationRepository`:
```typescript
constructor(
  private readonly taskRepository: TaskRepository,
  private readonly quotationRepository?: QuotationRepository,
) {}
```

In `execute()`:
```typescript
const linkedQuotations = this.quotationRepository
  ? await this.quotationRepository.findByTask(taskId)
  : [];
```

The optional dependency ensures zero regression on existing callers that do not inject `QuotationRepository`.

---

## 6. Infrastructure Layer

### 6.1 Schema Migration

1. Update `quotations` table status enum in `schema.ts` (see §4.2)
2. Run `npm run db:generate` — this produces a new migration file
3. The app's auto-migration at startup will apply it on next launch

---

## 7. UI Components

> *UI design reviewed with **mobile-ui agent** for alignment with existing layout, NativeWind tokens, and construction-app patterns.*

### 7.1 `QuotationForm` — Required Project field

**File**: `src/components/quotations/QuotationForm.tsx`

**Change**: In `validate()`, add:
```typescript
if (!selectedProjectId) {
  newErrors.project = 'Project is required';
}
```

Add a red asterisk (*) and error message below the Project picker row (consistent with how `total` errors render today).

**Mobile-UI note**: The picker row style and required indicator should match the `ContractorLookupField` pattern — label with `*` suffix, error text in `text-destructive text-xs mt-1`.

### 7.2 `TaskLinkedQuotationSection` (new component)

**File**: `src/components/tasks/TaskLinkedQuotationSection.tsx`

**Props**:
```typescript
export interface TaskLinkedQuotationSectionProps {
  quotations: Quotation[];
  onOpenQuotation: (quotationId: string) => void;
}
```

**Layout** (mobile-ui reviewed):

```
┌─────────────────────────────────────────────────────┐
│  QUOTATION                                           │ ← section label (uppercase, muted, tracking-wide)
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ ⚠️  Pending Approval                        │   │ ← yellow bg-yellow-50 border-yellow-200
│  │    {reference}   AUD {total}                │   │   border-l-4 border-yellow-400 for each pending_approval
│  │    [ Open Quotation → ]                     │   │
│  └─────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │ ✅ Accepted  {reference}   AUD {total}       │   │ ← green for accepted quotations
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

- Each `pending_approval` quotation renders a **yellow alert card** with:
  - `AlertTriangle` icon (yellow-600)
  - Text: `"Awaiting your approval"` + reference + total
  - `Pressable` "Open Quotation" link → `onOpenQuotation(quotation.id)`
- Each `accepted` quotation renders a compact green row
- Other statuses render a neutral row  
- Section title: `"Linked Quotation"` (singular for typical 1-quotation case; the list handles multiple)

### 7.3 `QuotationDetail` — Approve & Cancel Actions

**File**: `src/pages/projects/QuotationDetail.tsx`

**Add state**:
```typescript
const [approving, setApproving] = useState(false);
const [declining, setDeclining] = useState(false);
```

**Add Cancel and Approve buttons** below the existing `ScrollView` content (sticky footer area), visible only when `quotation.status === 'pending_approval'`:

```
┌─────────────────────────────────────────────────────┐
│  … existing quotation detail content …              │
│                                                     │
│  ┌────────────────────────┐ ┌─────────────────────┐ │
│  │  [ × Cancel ]          │ │ [ ✓ Approve ]       │ │
│  └────────────────────────┘ └─────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

On Approve press:
1. Show `Alert.alert('Approve Quotation', 'This will create an invoice for AUD {total}. Continue?', [Cancel, Approve])`
2. On confirm: call `approveQuotation(quotationId)` → show `ActivityIndicator` (on button)
3. On success: reload quotation (re-fetch) to show updated `Accepted` badge; action buttons disappear

On Cancel press:
1. Show `Alert.alert('Decline Quotation', 'Are you sure you want to decline this quotation?', [No, Yes])`
2. On confirm: call `declineQuotation(quotationId)` → show `ActivityIndicator` (on button)
3. On success: reload quotation (re-fetch) to show updated `Declined` badge; action buttons disappear

**Mobile-UI note**: Buttons should use Flex row. 'Approve' should use `bg-green-600` on success colour to match Accepted badge colour convention. 'Cancel' should be a destructive or secondary outlined button (`border-destructive text-destructive`). Same height/sizing as `CompleteTask` CTA.

---

## 8. Hook Changes

### 8.1 `useQuotations.ts`

Add `approveQuotation` and `declineQuotation` actions:

```typescript
const approveQuotation = useCallback(
  async (quotationId: string): Promise<ApproveQuotationOutput> => {
    // ... setup/try-catch wrapper
    const uc = new ApproveQuotationUseCase(invoiceRepo, repository, taskRepo);
    const result = await uc.execute({ quotationId });
    await queryClient.invalidateQueries({ queryKey: queryKeys.quotations() });
    await queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
    return result;
  },
  [repository, queryClient],
);

const declineQuotation = useCallback(
  async (quotationId: string): Promise<void> => {
    // ... setup/try-catch wrapper
    const uc = new DeclineQuotationUseCase(repository, taskRepo);
    await uc.execute({ quotationId });
    await queryClient.invalidateQueries({ queryKey: queryKeys.quotations() });
    await queryClient.invalidateQueries({ queryKey: queryKeys.tasks() });
  },
  [repository, queryClient],
);
```

### 8.2 `useTasks.ts` 

Update `getTaskDetail` call site to pass `QuotationRepository`; the hook re-exports `taskDetail.linkedQuotations` transparently.

---

## 9. Page Changes

### 9.1 `QuotationScreen.tsx` (modal)

Replace `useQuotations().createQuotation` with a call to `CreateQuotationWithTaskUseCase` so the auto-task is created on save.

The `onSubmit` handler in `QuotationForm` already delivers `projectId` (from #192). The screen simply constructs the payload and delegates to the new use case.

If `projectId` is missing and the use case throws `QUOTATION_PROJECT_REQUIRED`, surface an `Alert.alert` (same pattern as existing error handling).

### 9.2 `TaskDetailsPage.tsx`

Import and render `TaskLinkedQuotationSection` after `TaskQuotationSection`:

```tsx
{taskDetail?.linkedQuotations?.length > 0 && (
  <TaskLinkedQuotationSection
    quotations={taskDetail.linkedQuotations}
    onOpenQuotation={(id) =>
      navigation.navigate('QuotationDetail', { quotationId: id })
    }
  />
)}
```

### 9.3 Navigation

`TaskDetailsPage` is mounted in **three navigators**: `ProjectsNavigator`, `TasksNavigator` (if exists), and potentially `PaymentsNavigator`. Each navigator that shows `TaskDetailsPage` must also have `QuotationDetail` available in its stack (or use `navigation.navigate` cross-stack via Linking). Use the same pattern as `ProjectsNavigator` which already has both screens registered.

Check `TasksNavigator` and add `QuotationDetail` route if missing.

---

## 10. Test Plan

### 10.1 Unit Tests

| File | Scenario |
|------|----------|
| `CreateQuotationWithTaskUseCase.test.ts` | Creates task with correct defaults when projectId provided |
| `CreateQuotationWithTaskUseCase.test.ts` | Throws `QUOTATION_PROJECT_REQUIRED` when projectId absent |
| `CreateQuotationWithTaskUseCase.test.ts` | Returns `{ quotation, task }` with `quotation.taskId = task.id` |
| `ApproveQuotationUseCase.test.ts` | Transitions `pending_approval` → `accepted` and creates invoice |
| `ApproveQuotationUseCase.test.ts` | Updates linked task.quoteStatus when taskId set |
| `ApproveQuotationUseCase.test.ts` | Throws `QUOTATION_NOT_FOUND` when quotation absent |
| `ApproveQuotationUseCase.test.ts` | Throws `QUOTATION_NOT_PENDING_APPROVAL` for non-matching status |
| `DeclineQuotationUseCase.test.ts` | Transitions `pending_approval` → `declined` |
| `DeclineQuotationUseCase.test.ts` | Updates linked task.quoteStatus when taskId set |
| `DeclineQuotationUseCase.test.ts` | Throws `QUOTATION_NOT_PENDING_APPROVAL` for non-matching status |
| `GetTaskDetailUseCase.test.ts` (extend) | Returns `linkedQuotations` from QuotationRepository.findByTask() |
| `GetTaskDetailUseCase.test.ts` (extend) | Returns empty `linkedQuotations` when no QuotationRepository injected |
| `QuotationForm.test.tsx` (extend) | Submit without project selected → shows project required error |
| `TaskLinkedQuotationSection.test.tsx` | Renders yellow banner for `pending_approval` quotation |
| `TaskLinkedQuotationSection.test.tsx` | Calls onOpenQuotation with correct id on press |
| `TaskLinkedQuotationSection.test.tsx` | Renders green row for `accepted` quotation |
| `QuotationDetail.test.tsx` (extend) | Shows Approve and Cancel buttons for `pending_approval` status |
| `QuotationDetail.test.tsx` (extend) | Does not show Approve/Cancel buttons for `accepted` / `draft` / `declined` |

### 10.2 Integration Tests

| File | Scenario |
|------|----------|
| `CreateQuotationWithTask.integration.test.ts` | Full Drizzle flow: quotation + task created, taskId linked |
| `ApproveQuotation.integration.test.ts` | Full Drizzle flow: approve → invoice created, quotation updated, task updated |

---

## 11. Dependency Graph

```
QuotationScreen (modal)
  └── CreateQuotationWithTaskUseCase (NEW)
        ├── QuotationRepository
        └── TaskRepository

QuotationDetail (screen)
  └── ApproveQuotationUseCase (NEW)            ← invoked via useQuotations.approveQuotation
        ├── InvoiceRepository
        ├── QuotationRepository
        └── TaskRepository

TaskDetailsPage
  └── GetTaskDetailUseCase (EXTENDED)
        ├── TaskRepository (existing)
        └── QuotationRepository (NEW optional dep)
  └── TaskLinkedQuotationSection (NEW)
        └── onOpenQuotation → navigate("QuotationDetail")
```

---

## 12. Files Touched

### New files
- `src/application/usecases/quotation/CreateQuotationWithTaskUseCase.ts`
- `src/application/usecases/quotation/ApproveQuotationUseCase.ts`
- `src/application/usecases/quotation/DeclineQuotationUseCase.ts`
- `src/components/tasks/TaskLinkedQuotationSection.tsx`
- `__tests__/unit/CreateQuotationWithTaskUseCase.test.ts`
- `__tests__/unit/ApproveQuotationUseCase.test.ts`
- `__tests__/unit/TaskLinkedQuotationSection.test.tsx`
- `__tests__/integration/CreateQuotationWithTask.integration.test.ts`
- `__tests__/integration/ApproveQuotation.integration.test.ts`

### Modified files
- `src/domain/entities/Quotation.ts` — add `pending_approval` status
- `src/infrastructure/database/schema.ts` — extend quotations enum
- `drizzle/migrations/` — generated migration (via `npm run db:generate`)
- `src/application/usecases/task/GetTaskDetailUseCase.ts` — add `linkedQuotations`
- `src/components/quotations/QuotationForm.tsx` — enforce required project
- `src/pages/projects/QuotationDetail.tsx` — add Approve button + status config
- `src/pages/quotations/QuotationScreen.tsx` — use `CreateQuotationWithTaskUseCase`
- `src/pages/tasks/TaskDetailsPage.tsx` — render `TaskLinkedQuotationSection`
- `src/hooks/useQuotations.ts` — add `approveQuotation` action
- `__tests__/unit/GetTaskDetailUseCase.test.ts` — extend with `linkedQuotations`
- `__tests__/unit/QuotationForm.test.tsx` — project required validation test
- `__tests__/unit/QuotationDetail.test.tsx` — Approve button test

---

## 13. Out of Scope

- Reject action (decline quotation) — can be addressed in a follow-up
- Push notification when a quotation is approved
- Automatic task status progression on quotation approval (beyond `quoteStatus` update)
- Bulk approval of multiple quotations

---

## 14. Open Questions

1. **Task title format**: Is `"Review Quotation: {vendorName}"` the right default, or should it mirror the quotation reference (e.g. `"QUO-20260409-XD3K2A — [vendor]"`)? **A** "Review Quotation: {vendorName}" is preferred for clarity in the task list, since quotation references are often non-human-friendly.
2. **Task assignee**: Should the auto-created task be unassigned by default, or pre-filled with the quotation's `vendorId` as `subcontractorId`? **A** pre-filled `subcontractorId` is preferred to surface the task in the subcontractor's task list immediately, but it can be unassigned if the vendor is not a registered subcontractor.
3. **TasksNavigator**: Does `QuotationDetail` need to be registred in the tasks-stack navigator? Confirm navigation path from `TaskDetailsPage` for non-projects-stack entry points. **A** Yes, `QuotationDetail` should be registered in any navigator that includes `TaskDetailsPage` to ensure seamless navigation from the linked quotation section.
4. **Default quotation status on creation**: Should quotations created outside this use case (e.g. from test fixtures, programmatic API) also default to `pending_approval`, or remain `'draft'`? (Current proposal: only `CreateQuotationWithTaskUseCase` forces `pending_approval`; direct `CreateQuotationUseCase` keeps `'draft'` default.) **A** use `pending_approval` as the default status for all new quotations to enforce the approval workflow consistently, regardless of creation method.

---

*For developer agent: design doc is at `design/issue-195-create-task-for-quotation.md`. Begin with failing tests for `CreateQuotationWithTaskUseCase` and `ApproveQuotationUseCase` per §10.1.*
