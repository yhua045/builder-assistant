# Add UX Instrumentation for User Behavior & Feature Popularity (#223)

## Summary

Implemented a lightweight, pluggable analytics layer to track user interactions and feature usage across the app. Built with privacy-first design, no external dependencies, and zero UX impact.

### Key Additions
- **Domain**: `AnalyticsEvent` type with strict PII exclusion rules
- **Service Interface**: `IAnalyticsService` (pluggable port)
- **Adapters**: 
  - `AsyncStorageAnalyticsService` — production (local, private event persistence)
  - `NullAnalyticsService` — test/dev (no-op stub)
- **Hooks**: `useAnalytics()` and `useScreenView()` for UI integration
- **Instrumented Screens**: Dashboard (quick actions), TaskScreen (task lifecycle), ProjectsPage (project interactions)

### Architecture
Clean Architecture layers with inward-only dependency flow:
`UI Hooks → useAnalytics() → IAnalyticsService → AsyncStorageAnalyticsService`

No business logic in infrastructure; no PII in events; fire-and-forget emission (never blocks UI).

### Acceptance Criteria
- [x] **AC-1**: Consistent `<feature>.<action>` event naming across all screens
- [x] **AC-2**: Feature usage comparable across screens (Dashboard, TaskScreen, ProjectsPage)
- [x] **AC-3**: Fire-and-forget; async persistence silent; no UX degradation
- [x] **AC-4**: Zero PII collection (financial values, personal data explicitly excluded)
- [x] **AC-5**: Pluggable interface (test: `NullAnalyticsService`; prod: `AsyncStorageAnalyticsService`)
- [x] **AC-6**: 6 focused test suites (48 tests) verify all event emission paths
- [x] **AC-7**: Design doc + code comments provide extension pattern for future features

### Testing & Validation
- [x] TypeScript: `npx tsc --noEmit` **PASSED** (strict mode, 0 errors)
- [x] Linting: `npm run lint` **PASSED** (0 new errors)
- [x] Analytics: **7 test suites, 48 tests PASSING**

### Design & Future Reconciliation
See `design/issue-223-ux-instrumentation.md` for detailed tool evaluation (PostHog vs. Clarity vs. AsyncStorage), architecture decisions, and rationale.
Includes reconciliation plan with Issue #219 (`AnalyticsAdapter`) to layer local granular UX tracking with cloud funnel metrics.
