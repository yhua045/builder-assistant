
Date: 2026-02-05

Summary (concise)

Completed

2026-02-06

- Added TDD validation work for `CreateProjectUseCase` (Issue #24):
	- Unit tests: `__tests__/unit/CreateProjectUseCase.validation.test.ts` covering missing name, negative budget, and invalid timeline.
	- Integration tests: `__tests__/integration/CreateProjectUseCase.integration.test.ts` using an in-memory repository to verify persistence behaviour.
	- Implemented explicit request validation in `src/application/usecases/project/CreateProjectUseCase.ts` and added `src/domain/errors/ValidationError.ts`.
	- Fixed relative imports in several use case files to ensure tests resolve modules correctly.
	- All new tests pass locally.
## Native dependency notes

- The SQLite implementation uses a native module (`react-native-sqlite-storage`): after adding/updating native deps run:

```bash
cd ios && pod install && cd ..
npx react-native run-ios
# or for Android
npx react-native run-android
```


## Tests location and execution

- Unit tests: stored under `__tests__/unit`. These are fast, deterministic, and use lightweight in-memory shims where appropriate (for example in-memory repository implementations) so they can run without native DB dependencies.
- Integration tests: stored under `__tests__/integration`. Integration suites exercise the Drizzle adapter and run against an in-memory SQLite instance (the test harness uses a `better-sqlite3` :memory: adapter and the `react-native-sqlite-storage` mock) and include migrations before running.

Run unit tests:
```bash
npx jest __tests__/unit --runInBand
```

Run integration tests (single-threaded):
```bash
npx jest __tests__/integration --runInBand
```

