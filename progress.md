Date: 2026-02-03

Summary (concise)
- Architecture: On-device ML Kit OCR + TensorFlow Lite validation for receipt → draft expense flow (#9).
- Domain model: normalized `contacts` (with `RoleType`), `properties`, `projects`, and `work_variations` added.

Completed
- Created `design/#9-Plan.md` and updated it to reflect ML Kit + TF Lite decisions.
- Opened and updated GitHub issue #10 (domain model: `projects`, `properties`, `contacts`, `work_variations`).
- Implemented TypeScript domain entities and repository interfaces under `src/domain/{entities,repositories}` for core models.

Next steps
- Draft encrypted SQLite DDL for core tables and implement `Local*Repository` adapters (start with `projects`/`properties`).
- Add unit tests for repository queries (pending payments, upcoming schedule, property queries).

Status: Domain models and interfaces created — ready to draft DDL and repository implementations.