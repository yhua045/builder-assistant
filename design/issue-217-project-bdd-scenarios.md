# Design: Issue #217 Follow-up — BDD Scenarios for Projects Feature

Status: APPROVED
Author: Copilot
Date: 2026-04-30
Related issue: https://github.com/yhua045/builder-assistant/issues/217

---

## 1) Purpose

Propose exactly one BDD scenario for the Projects feature:

1. A component-level integration BDD test targeting real UI interaction and orchestration.

*(A unit-level BDD test targeting application behavior has been deferred for future implementation.)*

---

## 2) Current Coverage Review (What Already Exists)

Reviewed areas:

- `src/features/projects/application/CreateProjectUseCase.ts`
- `src/features/projects/components/ManualProjectEntry.tsx`
- `src/features/projects/components/ManualProjectEntryForm.tsx`
- `src/features/projects/tests/unit/CreateProjectUseCase.test.ts`
- `src/features/projects/tests/unit/components/ManualProjectEntry.test.tsx`
- `src/features/projects/tests/integration/ManualProjectEntryForm.integration.test.tsx`

Observations:

- CreateProject use case already has broad happy-path and validation unit tests.
- ManualProjectEntryForm integration tests currently focus on dropdown wiring and onSave payload shape.
- ManualProjectEntry unit tests currently call child `onSave` props directly (fast, but bypasses real user interaction flow).

Most useful gaps for BDD:

- End-to-end component orchestration from user input -> submit -> step transition -> critical-path suggestion trigger.

---

## 3) Proposed Scenario — Component Integration BDD

### 3.1 Target

- Subject: Manual project creation flow
- Components involved: `ManualProjectEntry` + `ManualProjectEntryForm`
- Layer: Component integration (React Native testing-library level)

### 3.2 Why this scenario

Existing tests verify pieces independently, but there is no BDD scenario that validates the user-driven orchestration path end-to-end:

- form input interactions,
- submit action,
- handoff into parent create logic,
- transition from details step to tasks step,
- suggestion trigger with selected project type and state.

### 3.3 Proposed Gherkin

Feature: Manual project creation flow

Scenario: Successful save moves to task suggestion step with selected project type and state
  Given I open the manual project entry form
  And I enter project name "Kitchen Renovation"
  And I enter address "123 Test Street"
  And I choose project type "Renovation"
  And I choose state "VIC"
  And create project succeeds with project id "proj-100"
  When I press "Save Project"
  Then create project should be called with projectType "renovation" and state "VIC"
  And the critical path suggestion should be requested with project_type "renovation" and state "VIC"
  And the task suggestion step should be visible for project "proj-100"

### 3.4 Acceptance assertions

- `createProject` called with trimmed name/address plus selected projectType/state
- `suggest` called with `{ project_type: 'renovation', state: 'VIC' }`
- step 2 UI renders (CriticalPathPreview visible)
- rendered step references returned `projectId`

### 3.5 Proposed file placement

- Feature file: `__tests__/bdd/features/projects/manual-project-entry-success.feature`
- Step file: `__tests__/bdd/steps/projects/manual-project-entry-success.steps.ts`

---

## 4) Test Boundaries and Mocking Strategy

Component integration BDD scenario:

- render React Native components with testing-library
- mock `useProjects` to control `createProject` result
- mock `useCriticalPath` to observe `suggest` call
- stub heavy/native-only dependencies already stubbed in existing project tests

This keeps tests deterministic and aligned with current project test practices.

---

## 5) Out of Scope

- No production code changes in this phase
- Unit test BDD scenario deferred
- No CI or Jest config changes

---

## 6) Approval Gate

1. Add 1 `.feature` file.
2. Add 1 matching step-definition file.
3. Keep existing tests unchanged.
4. Validate with `npm test` and `npx tsc --noEmit`.
