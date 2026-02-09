# Project Workflow Rules

This document describes the allowed status transitions for projects in the Builder Assistant application.

## Overview

Projects follow a defined workflow with specific allowed transitions between statuses. The workflow ensures that projects move through appropriate stages and prevents invalid state changes (e.g., jumping from PLANNING directly to COMPLETED).

## Project Statuses

| Status | Description |
|--------|-------------|
| `PLANNING` | Initial state. Project is being planned and scoped. |
| `IN_PROGRESS` | Active construction/work is underway. |
| `ON_HOLD` | Work has been temporarily paused. |
| `COMPLETED` | Project has been finished successfully. Terminal state. |
| `CANCELLED` | Project has been cancelled. Terminal state. |

## Status Transition Rules

### From PLANNING

| To Status | Allowed | Notes |
|-----------|---------|-------|
| `IN_PROGRESS` | ✅ Yes | Start construction after planning is complete |
| `CANCELLED` | ✅ Yes | Cancel project during planning phase |
| `ON_HOLD` | ❌ No | Cannot put a project on hold before it starts |
| `COMPLETED` | ❌ No | Must move to IN_PROGRESS before completing |

**Allowed next states:** `IN_PROGRESS`, `CANCELLED`

### From IN_PROGRESS

| To Status | Allowed | Notes |
|-----------|---------|-------|
| `COMPLETED` | ✅ Yes | Finish the project successfully |
| `ON_HOLD` | ✅ Yes | Temporarily pause active work |
| `CANCELLED` | ✅ Yes | Cancel an active project |
| `PLANNING` | ❌ No | Cannot move back to planning once started |

**Allowed next states:** `COMPLETED`, `ON_HOLD`, `CANCELLED`

### From ON_HOLD

| To Status | Allowed | Notes |
|-----------|---------|-------|
| `IN_PROGRESS` | ✅ Yes | Resume work after hold period |
| `CANCELLED` | ✅ Yes | Cancel a project that's on hold |
| `COMPLETED` | ❌ No | Must resume to IN_PROGRESS before completing |
| `PLANNING` | ❌ No | Cannot move back to planning from on hold |

**Allowed next states:** `IN_PROGRESS`, `CANCELLED`

### From COMPLETED

**Terminal State** - No transitions allowed once a project is completed.

**Allowed next states:** (none)

### From CANCELLED

**Terminal State** - No transitions allowed once a project is cancelled.

**Allowed next states:** (none)

## Workflow Diagram

```
┌─────────┐
│ PLANNING│
└────┬────┘
     │
     ├──────────────────┐
     │                  │
     v                  v
┌────────────┐    ┌──────────┐
│IN_PROGRESS │    │CANCELLED │ (terminal)
└─────┬──────┘    └──────────┘
      │
      ├──────┬─────────┐
      │      │         │
      v      v         │
 ┌────────┐ │         │
 │ON_HOLD │ │         │
 └────┬───┘ │         │
      │     │         │
      │     v         v
      │  ┌─────────┐ ┌──────────┐
      └─>│COMPLETED│ │CANCELLED │ (terminal)
         └─────────┘ └──────────┘
         (terminal)
```

## Implementation

### Service Location

The workflow validation is implemented in:
- **Interface & Service:** [`src/domain/services/ProjectWorkflowService.ts`](../src/domain/services/ProjectWorkflowService.ts)
- **Integration:** [`src/domain/services/ProjectValidationService.ts`](../src/domain/services/ProjectValidationService.ts)
- **Use Case Example:** [`src/application/usecases/project/UpdateProjectStatusUseCase.ts`](../src/application/usecases/project/UpdateProjectStatusUseCase.ts)

### API Usage

#### Check if a transition is allowed

```typescript
import { ProjectWorkflowService } from '../domain/services/ProjectWorkflowService';
import { ProjectStatus } from '../domain/entities/Project';

const workflowService = new ProjectWorkflowService();

const result = workflowService.canTransition(
  ProjectStatus.PLANNING,
  ProjectStatus.IN_PROGRESS
);

if (result.ok) {
  // Transition is allowed
  console.log('Transition allowed');
} else {
  // Transition is not allowed
  console.error(result.reason);
}
```

#### Get allowed next statuses

```typescript
const allowedStatuses = workflowService.allowedNext(ProjectStatus.PLANNING);
// Returns: [ProjectStatus.IN_PROGRESS, ProjectStatus.CANCELLED]
```

#### Using through ProjectValidationService

```typescript
import { ProjectValidationService } from '../domain/services/ProjectValidationService';

const validationService = new ProjectValidationService();

// Validate transition
const check = validationService.validateStatusTransition(
  currentStatus,
  newStatus
);

// Get allowed next statuses
const allowed = validationService.getAllowedNextStatuses(currentStatus);
```

#### Using the UpdateProjectStatusUseCase

```typescript
import { UpdateProjectStatusUseCase } from '../application/usecases/project/UpdateProjectStatusUseCase';

const useCase = new UpdateProjectStatusUseCase(
  projectRepository,
  validationService
);

// Attempt to update status
const result = await useCase.execute({
  projectId: 'project-123',
  newStatus: ProjectStatus.IN_PROGRESS,
  reason: 'Construction started',
});

if (result.success) {
  console.log('Status updated:', result.data);
} else {
  console.error('Transition failed:', result.error);
}

// Get allowed statuses for a project
const allowedResult = await useCase.getAllowedStatuses('project-123');
if (allowedResult.success) {
  console.log('Allowed statuses:', allowedResult.data);
}
```

## Common Scenarios

### Starting a Project

```typescript
// From PLANNING → IN_PROGRESS
await useCase.execute({
  projectId: 'proj-1',
  newStatus: ProjectStatus.IN_PROGRESS,
  reason: 'All permits approved, construction begins',
});
```

### Pausing Work

```typescript
// From IN_PROGRESS → ON_HOLD
await useCase.execute({
  projectId: 'proj-1',
  newStatus: ProjectStatus.ON_HOLD,
  reason: 'Weather delay - heavy rain',
});
```

### Resuming Work

```typescript
// From ON_HOLD → IN_PROGRESS
await useCase.execute({
  projectId: 'proj-1',
  newStatus: ProjectStatus.IN_PROGRESS,
  reason: 'Weather cleared, resuming work',
});
```

### Completing a Project

```typescript
// From IN_PROGRESS → COMPLETED
await useCase.execute({
  projectId: 'proj-1',
  newStatus: ProjectStatus.COMPLETED,
  reason: 'Final inspection passed',
});
```

### Cancelling a Project

```typescript
// From any non-terminal state → CANCELLED
await useCase.execute({
  projectId: 'proj-1',
  newStatus: ProjectStatus.CANCELLED,
  reason: 'Client requested cancellation',
});
```

## Error Messages

When an invalid transition is attempted, the service provides helpful error messages:

- **PLANNING → COMPLETED:** "Must move to IN_PROGRESS before COMPLETED"
- **ON_HOLD → COMPLETED:** "Must resume to IN_PROGRESS before COMPLETED"
- **From terminal states:** "Cannot transition from {status}: status is terminal"
- **Generic invalid transitions:** "Cannot transition from {current} to {next}. Allowed: {list}"

## Testing

Comprehensive tests are available at:
- **Service tests:** [`__tests__/unit/ProjectWorkflowService.test.ts`](../__tests__/unit/ProjectWorkflowService.test.ts)
- **Integration tests:** [`__tests__/unit/ProjectValidationService.workflow.test.ts`](../__tests__/unit/ProjectValidationService.workflow.test.ts)
- **Use case tests:** [`__tests__/unit/UpdateProjectStatusUseCase.test.ts`](../__tests__/unit/UpdateProjectStatusUseCase.test.ts)

## Future Considerations

### Making Workflows Configurable

The current implementation uses a fixed transition map. For future deployments that may require different workflow rules, consider:

1. **Dependency Injection:** The `ProjectValidationService` already accepts an optional `ProjectWorkflowService` via constructor, enabling custom implementations.

2. **Configuration-based workflows:** Load transition rules from a configuration file or database.

3. **State Machine Libraries:** For more complex workflows with guards, actions, and events, consider libraries like:
   - [XState](https://xstate.js.org/)
   - [Robot](https://thisrobot.life/)

### Additional Features

Potential enhancements:
- **Conditional transitions:** Allow transitions based on project properties (e.g., budget approval, permits)
- **Role-based transitions:** Different users can perform different transitions
- **Audit trail:** Track all status changes with timestamps and reasons (partially implemented in metadata)
- **Notifications:** Trigger notifications on status changes
- **Webhooks:** External system integration on workflow events

## References

- GitHub Issue: [#26 - Add centralized workflow validator](https://github.com/yhua045/builder-assistant/issues/26)
- Architecture: [ARCHITECTURE.md](../ARCHITECTURE.md)
- Database: [DATABASE_MIGRATIONS.md](DATABASE_MIGRATIONS.md)
