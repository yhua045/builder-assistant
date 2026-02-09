Date: 2026-02-06

Summary (concise)
- Architecture: On-device ML Kit OCR + TensorFlow Lite validation for receipt → draft expense flow (#9).
- Domain model: normalized `contacts` (with `RoleType`), `properties`, `projects`, and `work_variations` added.
- Database: See [DATABASE_MIGRATIONS.md](docs/DATABASE_MIGRATIONS.md) for migration details.
- **NEW:** Centralized workflow validator for project status transitions (#26) - implemented with TDD approach.

Completed
- Created `design/#9-Plan.md` and updated it to reflect ML Kit + TF Lite decisions.
- Opened and updated GitHub issue #10 (domain model: `projects`, `properties`, `contacts`, `work_variations`).
- Implemented TypeScript domain entities and repository interfaces under `src/domain/{entities,repositories}` for core models.
- UI: refactored dashboard and pages to use NativeWind/Tailwind; extracted reusable components for `QuickStats`, `ProjectsList`, `TasksList`, `TotalExpenseCard`, and `NextPaymentAlert`.
- **NEW (#26):** Implemented `ProjectWorkflowService` with centralized status transition validation
  - Created interface and implementation with explicit transition map
  - Integrated into `ProjectValidationService` for domain-level validation
  - Implemented `UpdateProjectStatusUseCase` demonstrating workflow validation in use cases
  - Added comprehensive test coverage (53 tests) following TDD approach
  - Documented workflow rules in `docs/WORKFLOWS.md`

## Native dependency notes

- The SQLite implementation uses a native module (`react-native-sqlite-storage`): after adding/updating native deps run:

```bash
cd ios && pod install && cd ..
npx react-native run-ios
# or for Android
npx react-native run-android
```


Branch: issue-27-drizzle-document-repo

Recent changes in this branch:
- Implemented `LocalDocumentStorageEngine` to store files on-device using `react-native-fs` when available, with a Node `fs` wrapper fallback and an injectable `FSLike` interface to allow unit testing and mocking.
- Made `LocalDocumentStorageEngine` handle binary and string inputs, return file `path` and `size`, and avoid bundler/runtime issues by using safe runtime checks and `buffer` where needed.
- Refactored code to avoid hard Node-only references (use `globalThis` and `buffer` import) so TypeScript checks pass without forcing Node runtime types into the RN bundles.
- Fixed TypeScript and linting issues across the codebase: corrected relative imports for use-cases, updated `useProjects` to call `list()` (returns `{ items, meta }`) instead of a removed `findAll()` helper, and adjusted `CreateProjectUseCase` accordingly.
- Updated `DrizzleProjectRepository` to conform to the `ProjectRepository` interface (return `meta` from `list`, adjusted `withTransaction` signature and transactional behavior, guarded undefined dates), and fixed several related compile errors.
- Ran lint and `npx tsc --noEmit`; resolved compiler errors so the branch type-checks cleanly.

Notes / Next steps:
- Add `react-native-fs` to `package.json` and install native deps when ready: `npm i react-native-fs` and run platform installation steps (`pod install` for iOS, rebuild for Android).
- Add unit tests that inject a mock `FSLike` into `LocalDocumentStorageEngine` to validate behavior without touching device storage.

