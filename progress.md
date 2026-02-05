Date: 2026-02-05

Summary (concise)
- Architecture: On-device ML Kit OCR + TensorFlow Lite validation for receipt → draft expense flow (#9).
- Domain model: normalized `contacts` (with `RoleType`), `properties`, `projects`, and `work_variations` added.
- Database: See [DATABASE_MIGRATIONS.md](docs/DATABASE_MIGRATIONS.md) for migration details.

Completed
- Created `design/#9-Plan.md` and updated it to reflect ML Kit + TF Lite decisions.
- Opened and updated GitHub issue #10 (domain model: `projects`, `properties`, `contacts`, `work_variations`).
- Implemented TypeScript domain entities and repository interfaces under `src/domain/{entities,repositories}` for core models.
- UI: refactored dashboard and pages to use NativeWind/Tailwind; extracted reusable components for `QuickStats`, `ProjectsList`, `TasksList`, `TotalExpenseCard`, and `NextPaymentAlert`.

## Native dependency notes

- The SQLite implementation uses a native module (`react-native-sqlite-storage`): after adding/updating native deps run:

```bash
cd ios && pod install && cd ..
npx react-native run-ios
# or for Android
npx react-native run-android
```

