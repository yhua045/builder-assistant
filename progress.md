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

