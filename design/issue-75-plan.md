# Implementation Plan - Task Module (Issue #75)

This plan outlines the implementation of the Task module to manage ad-hoc and scheduled tasks, ensuring full CRUD capabilities and UI parity with the Invoice module.

## 1. Domain Layer

### 1.1 Task Entity
Modify `src/domain/entities/Task.ts` to align with the requirements:
- **Fields**: `id`, `title`, `description` (mapped to `notes`), `isScheduled` (boolean), `scheduledAt` (Date), `dueDate` (Date), `status` (pending, in_progress, completed, blocked), `createdAt`, `updatedAt`, `projectId` (optional), `priority`.
- retain existing fields where possible for backward compatibility (e.g. `projectId` is effectively optional in business logic for ad-hoc tasks, though schema might enforce it - need to check/update schema).

### 1.2 Repository Interface
Update `src/domain/repositories/TaskRepository.ts`:
- Ensure methods exist: `create`, `update`, `delete`, `findById`, `findAll`, `findByProjectId`.

## 2. Infrastructure Layer

### 2.1 Database Schema
Update `src/infrastructure/database/schema.ts`:
- Make `projectId` nullable in `tasks` table (for ad-hoc tasks).
- Add `notes` (or map to description), `isScheduled` (boolean), `scheduledAt` (timestamp).
- Ensure `dueDate` and `completedDate` exist.

### 2.2 Drizzle Repository
Create `src/infrastructure/repositories/DrizzleTaskRepository.ts`:
- Implement `TaskRepository` interface using Drizzle ORM.
- Handle data mapping between Drizzle schema and Domain entity.

## 3. Application Layer (Use Cases)

Create use cases in `src/application/usecases/task/`:
- `CreateTaskUseCase.ts`
- `UpdateTaskUseCase.ts`
- `DeleteTaskUseCase.ts`
- `GetTaskUseCase.ts` (findById)
- `ListTasksUseCase.ts` (findAll / filter)

## 4. Presentation Layer (UI & Navigation)

### 4.1 Components
Create/Update components in `src/components/tasks/`:
- `TaskForm.tsx`: Form for creating/editing tasks. Reuse inputs from `src/components/inputs`.
- `TasksList.tsx`: Reusable list component (parity with `InvoiceList.tsx`).
- `TaskStatusBadge.tsx`: Visual status indicator.

### 4.2 Pages
Create pages in `src/pages/tasks/`:
- `TasksListPage.tsx`: Main list screen with filtering/search.
- `TaskDetailsPage.tsx`: Detailed view of a task.
- `CreateTaskPage.tsx` / `EditTaskPage.tsx`: Form screens.

### 4.3 Navigation
- Create `src/pages/tasks/TasksNavigator.tsx`:
  - Stack Navigator: `TasksList` -> `TaskDetails`, `CreateTask`, `EditTask`.
- Update `src/pages/tabs/index.tsx`:
  - Replace direct screen import with `TasksNavigator` for the "Work" tab.

## 5. Testing

### 5.1 Repository Tests
- Create `__tests__/integration/DrizzleTaskRepository.integration.test.ts`.
- Verify CRUD operations against a test database.

### 5.2 Use Case / Logic Tests
- Unit tests for complex logic if any (e.g. scheduling rules).

## 6. Execution Steps

1.  **Schema & Domain**: Update schema and entity definitions.
2.  **Repository**: Implement Drizzle repository.
3.  **Use Cases**: Implement application logic.
4.  **UI Components**: Build Form, List, Detail components using Invoice module as style reference.
5.  **Navigation**: Wire up screens.
6.  **Integration**: Verify flow works end-to-end.
