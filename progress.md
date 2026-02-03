Date: 2026-02-03

Summary (concise)
- Architecture: On-device ML Kit OCR + TensorFlow Lite validation for receipt → draft expense flow (#9).
- Domain model: normalized `contacts` (with `RoleType`), `properties`, `projects`, and `work_variations` added.

Completed
- Created `design/#9-Plan.md` and updated it to reflect ML Kit + TF Lite decisions.
- Opened and updated GitHub issue #10 (domain model: `projects`, `properties`, `contacts`, `work_variations`).
- Implemented TypeScript domain entities and repository interfaces under `src/domain/{entities,repositories}` for core models.

## Coding Convention Updates (DB + domain mapping)

- Domain identity: keep `id` as a stable UUID `string` (suitable for multi-device sync); add optional `localId?: number` to entities for the SQLite `local_id` primary key. This is the recommended hybrid model.
- Date handling: domain entities use JS `Date` objects; SQLite stores timestamps as integers (ms since epoch). Repositories must convert between `Date` and integer timestamps.
- JSON fields: complex arrays/objects (phase dependencies, materials_required, meta, roles) are stored as JSON text in SQLite and parsed by the repository.
- Repository responsibilities:
	- Map between storage representation and domain model (set `localId`, parse/format dates, parse JSON columns).
	- Implement transactional inserts/updates for parent + child tables (projects → phases + materials).
	- Expose domain-friendly query methods (e.g., `findByPropertyId`, `findByPhaseDateRange`).
- Keep domain entities immutable: repository should return domain `Project` objects and domain `ProjectEntity` should be used for business operations and validation.

## Native dependency notes

- The SQLite implementation uses a native module (`react-native-sqlite-storage`): after adding/updating native deps run:

```bash
cd ios && pod install && cd ..
npx react-native run-ios
# or for Android
npx react-native run-android
```

- For encrypted SQLite (SQLCipher) extra native configuration is required; consider this only if you need on-device encryption.

These notes reflect the current repository state and the hybrid `UUID + localId` approach which supports both reliable domain identities and efficient local DB storage.

Next steps
- Draft encrypted SQLite DDL for core tables and implement `Local*Repository` adapters (start with `projects`/`properties`).
- Add unit tests for repository queries (pending payments, upcoming schedule, property queries).

Repository testing (summary)
- Added unit and integration tests for `LocalSqliteProjectRepository`:
	- Unit: `__tests__/LocalSqliteProjectRepository.test.ts` — mocked `react-native-sqlite-storage` for fast mapping/logic checks.
	- Integration: `__tests__/LocalSqliteProjectRepository.integration.test.ts` — runs real SQLite via `better-sqlite3` (:memory:) to verify schema, transactions, CRUD, and that `localId` primary keys are assigned.

Status: Domain models and interfaces created — ready to draft DDL and repository implementations.