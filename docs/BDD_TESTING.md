# BDD Testing Guide

This project uses [jest-cucumber](https://github.com/bencompton/jest-cucumber) to support Behaviour-Driven Development (BDD) with Gherkin `.feature` files running inside the standard Jest test runner.

---

## How it works

| Layer | Location | Purpose |
|---|---|---|
| Feature files | `__tests__/bdd/features/` | Plain-English Gherkin scenarios |
| Step definitions | `__tests__/bdd/steps/` | TypeScript code wiring steps to use cases |
| Use cases | `src/features/*/application/` | Business logic under test |

Step definitions call **use cases directly with mocked repositories** — no database, no network, no React rendering. This keeps BDD tests fast and deterministic.

---

## Running BDD tests

```bash
# Run all tests (includes BDD)
npm test

# Run only BDD tests
npx jest --testPathPattern="__tests__/bdd"
```

---

## Adding a new feature scenario

### 1. Create a `.feature` file

Add a new file under `__tests__/bdd/features/`. Use standard Gherkin syntax:

```gherkin
Feature: Complete Task
  As a builder
  I want to mark a task as complete
  So that the project progress is updated

  Scenario: Completing an existing task
    Given a task with id "task-1" exists in project "proj-1"
    When I complete the task with id "task-1"
    Then the task status should be "completed"
```

**Naming convention:** `<use-case-slug>.feature`

### 2. Create the step definitions file

Add a corresponding file under `__tests__/bdd/steps/` with the same slug:

```typescript
import { defineFeature, loadFeature } from 'jest-cucumber';
import path from 'path';
import { CompleteTaskUseCase } from '../../../src/features/tasks/application/CompleteTaskUseCase';
import type { TaskRepository } from '../../../src/domain/repositories/TaskRepository';

const feature = loadFeature(
  path.join(__dirname, '../features/complete-task.feature'),
);

defineFeature(feature, test => {
  let useCase: CompleteTaskUseCase;
  let mockRepo: jest.Mocked<TaskRepository>;

  beforeEach(() => {
    mockRepo = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      // … fill in remaining methods as jest.fn()
    } as unknown as jest.Mocked<TaskRepository>;

    useCase = new CompleteTaskUseCase(mockRepo);
  });

  test('Completing an existing task', ({ given, when, then }) => {
    given(/^a task with id "(.*)" exists in project "(.*)"$/, (taskId, projectId) => {
      mockRepo.findById.mockResolvedValue({
        id: taskId,
        projectId,
        title: 'Some task',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    when(/^I complete the task with id "(.*)"$/, async (taskId) => {
      await useCase.execute(taskId);
    });

    then(/^the task status should be "(.*)"$/, (status) => {
      const [savedTask] = (mockRepo.update as jest.Mock).mock.calls[0];
      expect(savedTask.status).toBe(status);
    });
  });
});
```

### 3. Run and verify

```bash
npx jest --testPathPattern="__tests__/bdd" --no-coverage
```

All scenarios in the new feature file should pass before merging.

---

## Rules

- **One `.feature` file per use case or feature flow.** Do not put unrelated scenarios in the same file.
- **Step definitions must not import React or render components.** BDD tests target the application layer only.
- **Reuse the mock repository helper pattern** from existing step files rather than duplicating mock setup.
- **Feature file path in `loadFeature`** must use `path.join(__dirname, '../features/<name>.feature')` to work correctly in both local and CI environments.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `SyntaxError: Unexpected token 'export'` | ESM module not in transform allow-list | Add the package name to `transformIgnorePatterns` in `jest.config.js` |
| `Step definition not found` | Regex in step doesn't match feature text | Check quotes, whitespace, and regex special characters |
| `loadFeature` throws `ENOENT` | Wrong relative path | Use `path.join(__dirname, '../features/<name>.feature')` |
