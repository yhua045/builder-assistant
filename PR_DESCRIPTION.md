# Pull Request: Issue #181 — Safe "Mark as Complete" Validation for Tasks

## Summary

This PR implements task completion validation to seamlessly prevent users from marking tasks as complete while unresolved quotations remain attached. The solution follows Clean Architecture, with pure validation logic, a well-defined use case, and clean error handling surfaced to the UI.

**Branch**: `feature-issue-181-completion-validation`  
**Design Doc**: [design/issue-181-completion-validation.md](design/issue-181-completion-validation.md)  
**GitHub Issue**: #181

---

## What Changed

### Core Implementation

#### New Files
1. **`src/application/usecases/task/TaskCompletionValidator.ts`**
   - Pure, injectable validator service
   - Checks linked Quotation records (draft/sent status blocks completion)
   - Returns typed `ValidationResult` with pending quotation list on failure

2. **`src/application/usecases/task/CompleteTaskUseCase.ts`**
   - Orchestrates: fetch task → validate → update status
   - Throws `TaskCompletionValidationError` when validation fails

3. **`src/application/errors/TaskCompletionErrors.ts`**
   - `TaskCompletionValidationError` — carries `pendingQuotations[]` for UI feedback
   - `TaskNotFoundError` — for missing task ID

4. **Test Files** (3 suites, 31 tests all passing)
   - `__tests__/unit/TaskCompletionValidator.test.ts` — All validator branches
   - `__tests__/unit/CompleteTaskUseCase.test.ts` — Use case orchestration
   - `__tests__/integration/CompleteTaskUseCase.integration.test.ts` — Drizzle + SQLite

#### Modified Files

**`src/hooks/useTasks.ts`**
- Added `CompleteTaskUseCase` dependency
- Exposed `completeTask(taskId): Promise<void>` to UI layer via `UseTasksReturn` interface

**`src/pages/tasks/TaskDetailsPage.tsx`**
- Added `handleComplete` callback to orchestrate task completion
- Wired "Mark as Completed" button to `completeTask(taskId)`
- Caught `TaskCompletionValidationError` and displayed Alert with blocking quotation references
- Disabled button during async operation with visual feedback

**`__tests__/unit/TasksScreen.test.tsx`**
- Updated mock to include `completeTask` in `UseTasksReturn`

---

## Design Highlights

### Architecture
```
┌─────────────────────────────────────────────────────┐
│  UI (TaskDetailsPage)                                │
│  • Calls useTasks().completeTask(taskId)             │
│  • Catches TaskCompletionValidationError             │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│  Hook (useTasks)                                     │
│  • Instantiates CompleteTaskUseCase                  │
│  • Exposes completeTask(taskId): Promise<void>       │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│  Use Case (CompleteTaskUseCase)                      │
│  • Orchestrates: get task → validate → update       │
│  • Throws TaskCompletionValidationError              │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│  Validator (TaskCompletionValidator)                 │
│  • Pure, injectable business logic                   │
│  • Returns ValidationResult<PendingQuotations>       │
└────────────────┬────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────┐
│  Repositories (TaskRepository, QuotationRepository)  │
│  • Drizzle ORM backed by SQLite                      │
└─────────────────────────────────────────────────────┘
```

### Key Decisions
- **No schema changes**: Uses existing `quotations.task_id` column and index
- **Soft-delete safe**: Ignores quotations with `deletedAt` set
- **Quotation vs. Task Quote**: Feature operates on `Quotation` entity, not legacy `tasks.quote_status`
- **Offline-first**: Entirely local SQLite, no network dependency
- **DI pattern**: All dependencies injected; testable in isolation

---

## Test Coverage

| Test Suite | Tests | Coverage |
|---|---|---|
| TaskCompletionValidator unit | 9 | All validator branches (no QT / all resolved / pending) |
| CompleteTaskUseCase unit | 8 | Task-not-found, validation fail, success paths |
| CompleteTaskUseCase integration | 14 | End-to-end with Drizzle + SQLite in-memory |
| **Total** | **31** | ✅ All passing |

**Full validation**:
- ✅ `npx tsc --noEmit` — TypeScript strict clean
- ✅ `npm run lint` — No new ESLint errors (pre-existing baseline unchanged)
- ✅ Jest suite: 71 test suites, 446 tests, all passing

---

## User Experience

### Flow
1. User taps "Mark as Completed" on TaskDetailsPage
2. App validates linked Quotation records
3. **If all quotations resolved** (accepted/declined) or **no quotations exist**:
   - Task status → `completed`, timestamp → `completedAt`
   - User navigates back to task list
4. **If unresolved quotations found**:
   - Alert dialog shows: "Cannot Mark as Complete"
   - Lists blocking quotation references (e.g. "QT-2026-001, QT-2026-002")
   - User must resolve quotations before retrying

### Button State
- Normal: Enabled, tappable
- Loading: Disabled with ActivityIndicator
- Error: Enabled (for retry after fixing quotations)

---

## Acceptance Criteria ✅

| AC | Requirement | Status |
|---|---|---|
| AC-1 | Validator returns `{ ok: true }` when no quotations exist | ✅ Tested |
| AC-2 | Validator returns `{ ok: true }` when all quotations resolved | ✅ Tested |
| AC-3 | Validator returns `{ ok: false, reason, pendingQuotations }` for pending QTs | ✅ Tested |
| AC-4 | Use case throws `TaskCompletionValidationError` on validation failure | ✅ Tested |
| AC-5 | Use case persists completed status with timestamp | ✅ Tested |
| AC-6 | Use case throws `TaskNotFoundError` for invalid task ID | ✅ Tested |
| AC-7 | Hook catches error and displays Alert with QT references | ✅ Implemented |
| AC-8 | Button disabled during async operation | ✅ Implemented |
| AC-9-11 | All unit, use-case, integration tests passing | ✅ 31/31 passing |
| AC-12 | TypeScript strict clean, zero new errors | ✅ Verified |

---

## Files Changed

```
src/
  application/usecases/task/
    • TaskCompletionValidator.ts (new)
    • CompleteTaskUseCase.ts (new)
  errors/
    • TaskCompletionErrors.ts (new)
  hooks/
    • useTasks.ts (added completeTask)
  pages/tasks/
    • TaskDetailsPage.tsx (added handler, button wiring)

__tests__/
  unit/
    • TaskCompletionValidator.test.ts (new, 9 tests)
    • CompleteTaskUseCase.test.ts (new, 8 tests)
    • TasksScreen.test.tsx (updated mock)
  integration/
    • CompleteTaskUseCase.integration.test.ts (new, 14 tests)

design/
  • issue-181-completion-validation.md (design doc)

progress.md
  • (updated with Issue #181 summary)
```

---

## Testing Instructions

### Manual QA Checklist
- [ ] Open a task with no quotations → "Mark as Completed" should succeed immediately
- [ ] Create task with uncompleted quotation (draft/sent) → "Mark as Completed" should show Alert
- [ ] Alert displays correct quotation reference(s) and message
- [ ] Reject/accept quotation → "Mark as Completed" now succeeds
- [ ] Button shows loading spinner during async operation
- [ ] Network unavailable scenario: validation still works (offline-first)

### Automated Tests
```bash
# Type checking
npx tsc --noEmit

# Linting
npm run lint

# Run all tests
npm test

# Run specific test suite
npm test -- TaskCompletionValidator.test.ts
npm test -- CompleteTaskUseCase.test.ts
npm test -- CompleteTaskUseCase.integration.test.ts
```

---

## Notes for Reviewers

1. **Dependency Injection**: All repository and use case dependencies injected via constructor; no global state.
2. **Error Handling**: Typed errors (`TaskCompletionValidationError`, `TaskNotFoundError`) flow cleanly from use case → hook → UI.
3. **Offline-First**: No network calls required; entirely SQLite + Drizzle ORM; works on-device in airplane mode.
4. **Testability**: Pure validator service allows unit tests without mocking repositories (or with mocks as needed).
5. **Backwards Compatibility**: No breaking changes to existing APIs or repository contracts.

---

## Deployment Notes

- **No database migrations required** — uses existing schema
- **Feature flag**: Consider wrapping button behind feature flag if phased rollout desired
- **Production setup**: Wire `CompleteTaskUseCase` into DI container (already available, requires `tsyringe` registration)

---

## Related Issues / PRs

- Resolves GitHub Issue #181
- Depends on existing Quotation entity and repository (Issue #TBD)
- Related to task workflow (Issue #TBD)
