# Design: Issue #217 — Add BDD Test Setup and Required Dependencies

**Status**: DRAFT — pending approval  
**Author**: Copilot (architect mode)  
**Date**: 2026-04-30  
**GitHub Issue**: https://github.com/yhua045/builder-assistant/issues/217

---

## 1. Summary

Introduce BDD-style (Behaviour-Driven Development) testing infrastructure into the project so that feature behaviours can be described in plain-language Gherkin `.feature` files and verified with Jest step definitions. The setup must be lightweight, additive (no changes to existing tests), and fully compatible with the current React Native + TypeScript + Jest stack.

> **Mobile-UI Consultation**: This issue is purely test infrastructure — no new screens, components, or UI patterns are introduced. The `mobile-ui` agent review is not applicable for this ticket.

---

## 2. User Stories

| # | Story |
|---|---|
| US-1 | As a developer, I want to describe feature behaviour in plain English using Gherkin syntax so that acceptance criteria are testable and readable by non-engineers. |
| US-2 | As a developer, I want BDD tests to run via `npm test` (the existing Jest runner) so there is no additional CI or tooling step. |
| US-3 | As a developer, I want a concrete working example feature + step file to follow as a template for future BDD coverage. |
| US-4 | As a developer, I want the existing ~80 unit and integration tests to remain completely unaffected by the BDD addition. |

---

## 3. Acceptance Criteria

| # | Criterion |
|---|---|
| AC-1 | `jest-cucumber` is added as a `devDependency` in `package.json`. |
| AC-2 | A `__tests__/bdd/features/` directory exists and contains `.feature` files written in Gherkin syntax. |
| AC-3 | A `__tests__/bdd/steps/` directory exists and contains corresponding `*.steps.ts` step-definition files. |
| AC-4 | `jest.config.js` is updated so Jest discovers `*.steps.ts` files under `__tests__/bdd/` without breaking existing test discovery patterns. |
| AC-5 | At least one end-to-end BDD scenario (create-task) passes with `npm test`. |
| AC-6 | All existing unit and integration tests still pass after the setup is added (`npm test` is fully green). |
| AC-7 | TypeScript strict-mode passes with zero new errors (`npx tsc --noEmit`). |
| AC-8 | A brief `docs/BDD_TESTING.md` explains how to add new `.feature` files and step definitions. |

---

## 4. BDD Framework Selection

### 4.1 Candidate Evaluation

| Library | Gherkin files | Runs in Jest | TS support | Footprint |
|---|---|---|---|---|
| **`jest-cucumber`** | ✅ `.feature` | ✅ native | ✅ typings bundled | 1 package |
| `@cucumber/cucumber` | ✅ `.feature` | ❌ separate CLI | ✅ via `@cucumber/cucumber-js` | 3–5 packages + config |
| `jest-bdd` | ❌ code API only | ✅ native | ✅ | 1 package (no Gherkin) |

### 4.2 Decision: `jest-cucumber`

**Rationale:**
- Runs entirely inside Jest — `npm test` invokes everything without a separate Cucumber CLI.
- `.feature` files use standard Gherkin so the format is portable and readable.
- Ships its own TypeScript types; no `@types/*` packages needed.
- Single devDependency addition keeps the footprint minimal as the issue requests.
- Works with the existing `react-native` Jest preset without changes to `transformIgnorePatterns`.

---

## 5. Directory & File Structure

```
__tests__/
├── bdd/
│   ├── features/
│   │   └── create-task.feature          # Gherkin scenarios (one per use-case or flow)
│   └── steps/
│       └── create-task.steps.ts         # Step definitions wired to use-case mocks
├── integration/                         # (existing — untouched)
└── unit/                                # (existing — untouched)

docs/
└── BDD_TESTING.md                       # Developer guide for adding new BDD tests
```

---

## 6. Architectural Design

### 6.1 Layer Positioning

BDD step files sit **at the application boundary**: they call use cases directly with mocked repositories, mirroring the existing unit-test pattern. This keeps step definitions fast (no SQLite/network), deterministic, and independent of UI rendering.

```
┌──────────────────────────────────────────────────────┐
│  BDD Step Definitions  (__tests__/bdd/steps/*.ts)    │
│  — instantiate use case with mock repository         │
│  — assert on returned entity or thrown error         │
├──────────────────────────────────────────────────────┤
│  Application Layer  (src/features/*/application/)    │
│  Use cases (CreateTaskUseCase, CompleteTaskUseCase…) │
├──────────────────────────────────────────────────────┤
│  Domain Layer  (src/domain/)                         │
│  Entities, Repository interfaces                     │
└──────────────────────────────────────────────────────┘
```

For integration-level BDD scenarios (future work), step definitions may use the `better-sqlite3` in-memory adapter pattern already established in `__tests__/integration/`.

### 6.2 `jest.config.js` Changes

Add BDD step files to the test match pattern. The existing `testRegex`/preset default matches `**/__tests__/**/*.[jt]s?(x)` so files in `__tests__/bdd/steps/` are already discovered. The only required change is to **exclude** raw `.feature` files from Jest's transform pipeline (they are parsed by `jest-cucumber` internally, not by Jest's transformer):

```js
// jest.config.js — additions only
moduleNameMapper: {
  '^@env$': '<rootDir>/__mocks__/@env.js',
  // Feature files are loaded by jest-cucumber, not transformed by Jest
},
testPathIgnorePatterns: [
  '<rootDir>/worktrees/.*',
  '<rootDir>/__tests__/utils/.*',
  // No change — .feature files are not in testPathIgnorePatterns; they are
  // never themselves test files, so Jest ignores them automatically.
],
```

No changes to `transformIgnorePatterns` are required.

### 6.3 Proof-of-Concept: `create-task.feature`

```gherkin
Feature: Create Task
  As a builder
  I want to create a new task for a project
  So that I can track work that needs to be done

  Scenario: Creating a task with all required fields
    Given a project with id "proj-1" exists
    When I create a task with title "Lay foundation" for project "proj-1"
    Then the task is saved with status "pending"
    And the task title is "Lay foundation"

  Scenario: Creating a task with a predetermined id
    Given a project with id "proj-2" exists
    When I create a task with id "task-abc" and title "Frame walls" for project "proj-2"
    Then the task is saved with id "task-abc"

  Scenario: Creating a task without a title fails
    Given a project with id "proj-3" exists
    When I try to create a task with no title for project "proj-3"
    Then the task creation should fail with a validation error
```

### 6.4 Step Definition Pattern (`create-task.steps.ts`)

```typescript
import { defineFeature, loadFeature } from 'jest-cucumber';
import { CreateTaskUseCase } from '../../../src/features/tasks/application/CreateTaskUseCase';
import type { TaskRepository } from '../../../src/domain/repositories/TaskRepository';
import type { Task } from '../../../src/domain/entities/Task';

const feature = loadFeature('__tests__/bdd/features/create-task.feature');

defineFeature(feature, test => {
  let useCase: CreateTaskUseCase;
  let mockRepo: jest.Mocked<TaskRepository>;
  let result: Task;
  let error: Error | undefined;

  beforeEach(() => {
    mockRepo = { save: jest.fn(), /* … */ } as unknown as jest.Mocked<TaskRepository>;
    useCase = new CreateTaskUseCase(mockRepo);
    error = undefined;
  });

  test('Creating a task with all required fields', ({ given, when, then, and }) => {
    given(/^a project with id "(.*)" exists$/, (_projectId) => { /* no-op: repo is mocked */ });
    when(/^I create a task with title "(.*)" for project "(.*)"$/, async (title, projectId) => {
      result = await useCase.execute({ projectId, title, status: 'pending' });
    });
    then(/^the task is saved with status "(.*)"$/, (status) => {
      expect(result.status).toBe(status);
    });
    and(/^the task title is "(.*)"$/, (title) => {
      expect(result.title).toBe(title);
    });
  });

  // … additional scenario blocks follow the same pattern
});
```

---

## 7. Implementation Plan (TDD Phases)

### Phase 0 — Design (this document)
- [x] Record design and acceptance criteria

### Phase 1 — Install & Configure (RED)
1. `npm install --save-dev jest-cucumber`
2. Verify `jest.config.js` picks up `.steps.ts` files (no changes expected)
3. Create `__tests__/bdd/features/create-task.feature` with Gherkin scenarios
4. Create `__tests__/bdd/steps/create-task.steps.ts` as a **failing** scaffold (step functions throw `'step not yet implemented'`)
5. Run `npm test` — new BDD tests appear as **failing** (RED)

### Phase 2 — Implement Steps (GREEN)
6. Implement step-definition bodies against `CreateTaskUseCase` with mocked `TaskRepository`
7. Run `npm test` — all BDD scenarios pass, all existing tests still pass (GREEN)

### Phase 3 — Document
8. Create `docs/BDD_TESTING.md` with step-by-step guide for adding new features

### Phase 4 — Type Check
9. Run `npx tsc --noEmit` — zero errors

---

## 8. Files To Create / Modify

| Action | File | Notes |
|---|---|---|
| **Modify** | `package.json` | Add `jest-cucumber` to `devDependencies` |
| **Create** | `__tests__/bdd/features/create-task.feature` | Proof-of-concept Gherkin feature |
| **Create** | `__tests__/bdd/steps/create-task.steps.ts` | Jest-Cucumber step definitions |
| **Create** | `docs/BDD_TESTING.md` | Developer guide |
| **No change** | `jest.config.js` | Existing discovery rules cover `__tests__/bdd/steps/` |
| **No change** | `jest.setup.js` | No new global mocks required |
| **No change** | All existing tests | Verified untouched |

---

## 9. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| `jest-cucumber` `loadFeature()` path resolution differs in CI vs local | Low | Use `__dirname`-relative path or configure `featurePath` in `jest.config.js` |
| `.feature` files accidentally matched as Jest tests | Very Low | Jest only runs files matching `*.[jt]s?(x)` — `.feature` files are never executed directly |
| Existing `transformIgnorePatterns` conflict | Very Low | `jest-cucumber` is pure JS/TS; no native modules, no transform required |
| Step-definition verbosity growing over time | Medium | Establish shared `world` / `context` helper pattern in a future iteration |

---

## 10. Open Questions

- Should BDD tests run in a **separate Jest project** (via `projects` in `jest.config.js`) to allow `npm test -- --testPathPattern=bdd` isolation? Defer to developer preference — the default (single project) is acceptable for the initial setup.
- Should integration-level BDD scenarios (against better-sqlite3) be added in this ticket or in a follow-on? Recommendation: **defer** — keep this ticket to the minimal proof-of-concept with mocked repositories.
