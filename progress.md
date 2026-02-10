Date: 2026-02-06

Summary (concise)

Completed
  - Created interface and implementation with explicit transition map
  - Integrated into `ProjectValidationService` for domain-level validation
  - Implemented `UpdateProjectStatusUseCase` demonstrating workflow validation in use cases
  - Added comprehensive test coverage (53 tests) following TDD approach
  - Documented workflow rules in `docs/WORKFLOWS.md`

## Native dependency notes


```bash
cd ios && pod install && cd ..
npx react-native run-ios
# or for Android
npx react-native run-android
```


Branch: issue-27-drizzle-document-repo

- Ran lint and `npx tsc --noEmit`; resolved compiler errors so the branch type-checks cleanly.


Date: 2026-02-11

Branch: issue-31-invoice-repository

Critical changes (concise):
- Resolved merge conflicts and fast-forwarded onto `master`; regenerated migrations (added `drizzle/migrations/0002_faithful_molecule_man.sql`).
- Implemented invoices end-to-end: added `InvoiceEntity` defaults, made JSON-backed fields explicit text in schema, manually serialize/parse `lineItems`, `tags`, `metadata`, and normalized snake_case/camelCase mapping and timestamp handling in `DrizzleInvoiceRepository`.
- Fixed repository contract and import bugs (e.g., `InMemoryProjectRepository` list/meta shape) and hardened `DrizzleProjectRepository.withTransaction` to await/rollback correctly.
- Addressed widespread TS and ESLint issues across the workspace so the project type-checks and lints; updated tests accordingly.
- Result: all unit and integration tests pass locally (13 suites, 77 tests).
- Add unit tests that inject a mock `FSLike` into `LocalDocumentStorageEngine` to validate behavior without touching device storage.

