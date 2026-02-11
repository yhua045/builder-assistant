# #39 — Add Project Form (Manual Project Entry)

## Summary / User Story

As a user, I want to create a new Project using a Manual Project Entry form so I can record projects that are not created via import or automation.

## Scope

- Add a UI form opened from the existing `Manual Project Entry` button.
- Form fields map to the `Project` entity and use existing form primitives/components.
- Save validates input and calls the project's create use-case; Cancel closes without saving.

## Proposed Fields

- Name (string) — required
- Description (multiline) — optional
- Project Owner (select) — optional (user id)
- Address (string) — required
- Team (select / multi-select) — optional
- Visibility (enum) — Public / Private (default Public)
- Start Date (date) — optional
- End Date (date) — optional; must be >= Start Date when both present
- Budget Amount (number) — optional
- Priority (enum) — Low / Medium / High (default Low)
- Notes (multiline) — optional

Status: always default to `Draft` on creation.

## Validation Rules

- `Name` is required.
- `Status` must be present (set to `Draft`).
- If both `Start Date` and `End Date` are present then `End Date >= Start Date`.
- Address and Project Owner form a "unique" validation: if either is null, skip uniqueness check; if both present, call repository/use-case validation to ensure uniqueness (e.g., no duplicate project for same owner+address).
- Inline field error display for each failing rule.

## UI / Behaviour Contract

- Component: `ManualProjectEntryForm` (new)
  - Props: `visible: boolean`, `onSave(projectDto)`, `onCancel()`
  - Renders as modal on mobile or as screen on platforms per existing conventions.
  - Uses shared form inputs from `src/components` (TextInput, Select, DatePicker, NumberInput, Button).
  - `Save` is primary; `Cancel` closes without calling `onSave`.

- Hooking: `ManualProjectEntryButton` should open the form and pass `onSave` which calls `useProjects().createProject(...)`.

## Acceptance Criteria (testable)

- The `Manual Project Entry` button opens the `ManualProjectEntryForm`.
- The form shows the listed fields with defaults applied.
- Saving with valid data calls the create use-case with a correctly mapped Project DTO and closes the form (or navigates back) while showing success feedback.
- Saving with invalid data shows inline errors and does not call create.
- Cancel closes the form without calling create.

## Tests (TDD)

1. Unit tests (fast, in `__tests__/unit/`):
   - `ManualProjectEntryButton.test.tsx`: clicking button opens form.
   - `ManualProjectEntryForm.test.tsx`: fills fields, asserts validation behavior; when valid, `onSave` called with expected DTO; when invalid, inline errors shown and `onSave` not called.
   - `CreateProjectUseCase.test.ts` (or integration of `useProjects`): assert mapping from form DTO to domain entity and that repository is called.

2. Integration tests (optional, in `__tests__/integration/`):
   - Create persists via `DrizzleProjectRepository` (sqlite in-memory) and record exists.

3. Snapshot tests (UI consistency) only for small components if helpful.

## Implementation notes

- File locations:
  - `src/components/ManualProjectEntryForm.tsx` (new)
  - `src/components/ManualProjectEntryButton.tsx` (existing — wire to form)
  - Tests under `__tests__/unit/ManualProjectEntryForm.test.tsx` and `__tests__/unit/ManualProjectEntryButton.test.tsx`.

- Use existing hooks: call `useProjects()` if it exposes a `createProject` method. If absent, introduce a thin adapter or use-case in `src/application/usecases` that implements `createProject(projectDto)` and inject repository.

- Reuse existing styling primitives and spacing utilities to match app design.

- For uniqueness validation (owner+address): implement it in the create use-case so the repository can perform the DB check. For unit tests keep this check mocked.

## TDD Plan / Steps (detailed)

1. Design: (this doc) — agree on fields, props, tests.
2. Tests: Add failing unit tests for UI open/save/cancel and create use-case call.
3. Implementation: Add `ManualProjectEntryForm` UI (minimal fields) and wire `ManualProjectEntryButton`.
4. Glue: Hook `onSave` to `useProjects().createProject` (or new use-case) and map DTO.
5. Run tests and iterate until green.
6. Refactor for clarity, add integration tests that use Drizzle if needed.
7. Update `progress.md` and open PR referencing this design doc.

## Notes / Open Questions

- `Project Owner` is a selection from existing users
- Modal vs dedicated screen: follow platform conventions; default to modal for now and adjust if UX review prefers navigation.

---

Design file created for issue #39. Link this file from PR and `progress.md` when complete.
