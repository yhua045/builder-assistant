# Feature: Knowledge Embedding Project Selection

## Goal

Allow users to start knowledge embedding for an existing project or create a new project when beginning the flow. Existing projects should be the quickest path, while first-time users should retain the current new-project experience.

## User Journey

1. The user opens the first knowledge-embedding step.
2. If projects exist, the user sees the existing-project selector with an existing project selected by default.
3. The user selects an existing project or chooses to create a new project.
4. For an existing project, project details are hidden and the user proceeds directly to Upload Documents.
5. For a new project, the user enters a project name and optional address, then continues through the existing flow.

## Acceptance Criteria

### AC1

**Given** existing projects are available,
**when** the user opens the first knowledge-embedding step,
**then** the existing-project option is visible and an existing project is selected by default.

### AC2

**Given** no projects exist,
**when** the user opens the first knowledge-embedding step,
**then** the existing-project option is hidden and the new-project fields are shown.

### AC3

**Given** the user selects an existing project,
**when** the selection is applied,
**then** the project name and address fields are hidden and the user can proceed directly to Upload Documents.

### AC4

**Given** the user selects the option to create a new project,
**when** the new-project flow is shown,
**then** the project name field is required and the address field is optional.

### AC5

**Given** the user switches between an existing project and creating a new project,
**when** the selection changes,
**then** any unsaved new-project details are cleared.

## Edge Cases

* A project selected for knowledge embedding can be edited later from the project screen.
* The existing-project option must not appear when the project list is empty.
* The user cannot continue the new-project flow without entering a project name.

## Out of Scope

* Editing existing project details within this flow.
* Changing project details from the project screen.
* Changes to document parsing, embedding, or processing behavior.
* Selecting or uploading files beyond the existing Upload Documents flow.

## Rules

1. Acceptance criteria describe observable user behavior.
2. The existing project selection is the default only when at least one project exists.
3. New-project details are cleared when the user changes the flow selection.
