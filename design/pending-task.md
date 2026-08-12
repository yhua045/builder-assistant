# Pending Tasks

Last updated: 2026-08-12

## Current status

The knowledge-embedding onboarding flow has been scaffolded and the first-run empty-project launch gate is in place. The screen is intentionally isolated from the main project flow and acts as a modular onboarding experience rather than a redesign of the existing project modules.

This document captures the remaining work for the feature and is intentionally limited to planning/status, not implementation.

---

## Remaining tasks

### 1. Visual fidelity to the Figma mock
- Tighten spacing, typography, and proportions to better match the approved mock.
- Refine the phone-shell composition and background styling to align more closely with the design.
- Finalize the exact text hierarchy and step card details for the welcome and project-type screens.

### 2. Complete the onboarding flow state logic
- Confirm the full sequence from welcome -> project type -> documents -> processing -> completion.
- Add consistent transition behavior between steps.
- Ensure step validation is explicit and reliable before continuing.

### 3. Real project/session integration
- Connect the onboarding flow to a real project/session model instead of local UI-only placeholders.
- Persist the selected project type and project details in the app data model.
- Decide how the generated session will be represented when the user exits and reopens the flow.

### 4. Real document upload workflow
- Replace demo document entries with real file selection and upload handling.
- Support the actual document types expected in the workflow (plans, approvals, layouts, etc.).
- Add validation for file format, size, and document readiness.

### 5. Processing and extraction backend wiring
- Connect the analysis step to a real document parsing/embedding pipeline.
- Define how the extracted content is stored and surfaced back to the app.
- Add progress/error states for document processing failures or incomplete ingestion.

### 6. Future integration into the main project experience
- Keep the current module isolated for the first-run experience as agreed.
- Plan the later expansion of the project screen to expose this feature from the normal app flow.
- Define the exact screen entry point and project-level actions once the startup flow is stable.

---

## Explicit non-goals for this phase

- Do not redesign the existing project flow.
- Do not add broad feature changes outside the empty-project onboarding module.
- Do not wire the full analysis backend before the UX and data model are agreed.

## Recommended next phase

Complete the remaining UX and data-model tasks above before implementing the real ingestion and processing pipeline. Once the flow is stable, the feature can be expanded into the normal project screen without disrupting existing app behavior.
