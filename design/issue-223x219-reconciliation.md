# Design Plan: Reconciliation of #219 Analytics Adapter + #223 UX Instrumentation

**Date**: 2026-05-14  
**Status**: Draft — Architect Review  
**Relates to**: [issue-219-analytics-monitoring.md](issue-219-analytics-monitoring.md), [issue-223-ux-instrumentation.md](issue-223-ux-instrumentation.md)

---

## 1. Problem Statement

Two independent issues shipped analytics infrastructure that now overlaps:

| Issue | Abstraction | Adapters | Purpose |
|---|---|---|---|
| **#219** | `AnalyticsAdapter` (abstract class) + `CompositeAnalyticsAdapter` | `FirebaseAnalyticsAdapter`, `MixpanelAnalyticsAdapter` | Cloud product analytics & behavioural funnels |
| **#223** | `IAnalyticsService` (interface) | `AsyncStorageAnalyticsService` | Local, privacy-safe, on-device UX event buffering |

**Result**: the codebase has two DI tokens (`'AnalyticsAdapter'` and `'AnalyticsService'`), two abstract contracts, two test stubs, and two calling conventions. The `CompositeAnalyticsAdapter` is unaware of the local storage adapter, so its opt-out gate does not cover local events. The `useAnalytics` hook currently resolves only the `IAnalyticsService` token and cannot route events to Firebase/Mixpanel.

---

## 2. Goals

| # | Goal |
|---|---|
| G-1 | Single abstract base — `AnalyticsAdapter` — for all analytics adapters |
| G-2 | `AsyncStorageAnalyticsAdapter` (renamed/refactored from `AsyncStorageAnalyticsService`) is a peer of `FirebaseAnalyticsAdapter` and `MixpanelAnalyticsAdapter` inside `CompositeAnalyticsAdapter` |
| G-3 | `CompositeAnalyticsAdapter`'s opt-out gate covers the local storage adapter automatically |
| G-4 | Single DI token (`'AnalyticsAdapter'`) consumed by hooks |
| G-5 | Preserve granular `<feature>.<action>` event naming and strict PII exclusion from #223 |
| G-6 | Call sites updated to the unified `track(event: string, properties?)` signature |
| G-7 | `IAnalyticsService` interface deprecated with no new consumers |

---

## 3. Architecture — After Reconciliation

```
Screens / Hooks
      ↓
useAnalytics() → resolves 'AnalyticsAdapter' → CompositeAnalyticsAdapter
                                                      │
                              ┌───────────────────────┼───────────────────────┐
                              ↓                       ↓                       ↓
             FirebaseAnalyticsAdapter   MixpanelAnalyticsAdapter   AsyncStorageAnalyticsAdapter
              (cloud funnels / DAU)      (cohorts / drop-off)        (local on-device buffer)
```

`CompositeAnalyticsAdapter`'s `optOutProvider` gate applies uniformly to **all three** adapters.

---

## 4. API Delta

### 4.1 `AsyncStorageAnalyticsAdapter` (new class replacing `AsyncStorageAnalyticsService`)

Extends `AnalyticsAdapter` abstract class instead of implementing `IAnalyticsService`:

| Old method (`IAnalyticsService`) | New method (`AnalyticsAdapter`) | Notes |
|---|---|---|
| `track({name, properties?})` | `track(event: string, properties?: Record<string, unknown>)` | Bridges to internal `AnalyticsEvent`; `name = event`, adds `timestampUtc` |
| `trackScreen(screenName, props?)` | `screen(screenName, props?)` | Stored as `{ name: 'screen.viewed', properties: { screen: screenName } }` |
| — | `identify(userId: string)` | **No-op** — local storage, no user identity tracking |
| — | `reset()` | Clears in-memory buffer **and** AsyncStorage key |
| `getEvents(): Promise<AnalyticsEvent[]>` | `getEvents(): Promise<AnalyticsEvent[]>` | **Extra public method** (not on `AnalyticsAdapter` abstract base) |
| `clearEvents(): Promise<void>` | `clearEvents(): Promise<void>` | **Extra public method** (not on `AnalyticsAdapter` abstract base) |

The internal `AnalyticsEvent` domain type (with `name`, `timestampUtc`, and `properties`) is an **implementation detail** of `AsyncStorageAnalyticsAdapter` — it does not surface into the abstract interface.

### 4.2 `useAnalytics` hook

| Old | New |
|---|---|
| Resolves `'AnalyticsService'` typed as `IAnalyticsService` | Resolves `'AnalyticsAdapter'` typed as `AnalyticsAdapter` |
| Returns `{ track, trackScreen }` | Returns `{ track, screen }` |
| `track({name, properties})` | `track(event: string, properties?)` |
| `trackScreen(screenName, properties?)` | `screen(screenName, properties?)` |
| Fallback: `new NullAnalyticsService()` | Fallback: `new NoopAnalyticsAdapter()` |

### 4.3 `useScreenView` hook

| Old | New |
|---|---|
| Calls `trackScreen(screenName, properties)` from `useAnalytics()` | Calls `screen(screenName, properties)` from `useAnalytics()` |

### 4.4 Call-site signature change

Every instrumented hook changes its calling convention:

```ts
// Before (#223 IAnalyticsService API)
track({ name: 'receipt.snap_started' });
track({ name: 'task.created', properties: { method: 'voice' } });

// After (unified AnalyticsAdapter API)
track('receipt.snap_started');
track('task.created', { method: 'voice' });
```

---

## 5. DI Registration Changes (`registerServices.ts`)

```ts
// REMOVE:
container.registerSingleton('AnalyticsService', AsyncStorageAnalyticsService);

// ADD AsyncStorageAnalyticsAdapter to CompositeAnalyticsAdapter:
container.register('AnalyticsAdapter', {
  useFactory: () => new CompositeAnalyticsAdapter(
    [
      new FirebaseAnalyticsAdapter(),
      new MixpanelAnalyticsAdapter(mixpanelToken),
      new AsyncStorageAnalyticsAdapter(),        // ← new
    ],
    getOptOutState,
  ),
});
```

The `AsyncStorageAnalyticsAdapter` is added as the **third** adapter in the array. Order does not affect correctness but keeping cloud adapters first is conventional.

---

## 6. File Inventory

### New files
| File | Description |
|---|---|
| `src/infrastructure/analytics/AsyncStorageAnalyticsAdapter.ts` | Refactored class extending `AnalyticsAdapter` |
| `__tests__/unit/analytics/AsyncStorageAnalyticsAdapter.test.ts` | Unit tests for the new adapter |

### Modified files
| File | Change |
|---|---|
| `src/hooks/useAnalytics.ts` | Resolve `'AnalyticsAdapter'`; update return type; fallback to `NoopAnalyticsAdapter` |
| `src/hooks/useScreenView.ts` | Use `screen(...)` instead of `trackScreen(...)` |
| `src/infrastructure/di/registerServices.ts` | Add `AsyncStorageAnalyticsAdapter` to composite; remove `'AnalyticsService'` registration |
| `src/features/dashboard/hooks/useDashboard.ts` | Update `track({name, ...})` → `track(name, ...)` |
| `src/features/tasks/hooks/useTaskScreen.ts` | Update track call signatures |
| `src/features/projects/hooks/useProjectsPage.ts` | Update track call signatures |
| `src/features/invoices/hooks/useInvoiceUpload.ts` | Update track call signatures |
| `src/features/receipts/hooks/useSnapReceiptScreen.ts` | Update track call signatures |
| `src/features/quotations/hooks/useQuotationUpload.ts` | Update track call signatures |
| `__tests__/unit/AsyncStorageAnalyticsService.test.ts` | Rename + update to new adapter API |
| `__tests__/unit/IAnalyticsService.contract.test.ts` | Replace with `AnalyticsAdapter` contract test for `AsyncStorageAnalyticsAdapter` |
| `__tests__/integration/analytics/container.analytics.integration.test.ts` | Add `AsyncStorageAnalyticsAdapter instanceof AnalyticsAdapter` assertion; add 3-adapter composite test |
| `__tests__/unit/useAnalytics.test.tsx` | Update hook API assertions |
| `__tests__/unit/analytics/useScreenTracking.test.ts` | Update `trackScreen` → `screen` assertions |

### Deprecated files (mark `@deprecated`, keep for transition)
| File | Reason |
|---|---|
| `src/infrastructure/analytics/AsyncStorageAnalyticsService.ts` | Superseded by `AsyncStorageAnalyticsAdapter` |
| `src/application/services/IAnalyticsService.ts` | Superseded by `AnalyticsAdapter` abstract class |
| `src/infrastructure/analytics/NullAnalyticsService.ts` | Superseded by `NoopAnalyticsAdapter` |

---

## 7. TDD Plan

### Red Phase — write failing tests first

#### `__tests__/unit/analytics/AsyncStorageAnalyticsAdapter.test.ts`

| Test | Assertion |
|---|---|
| Is an `AnalyticsAdapter` | `new AsyncStorageAnalyticsAdapter() instanceof AnalyticsAdapter` |
| `track(event: string)` persists as `AnalyticsEvent.name` | `getEvents()` returns `[{ name: 'event', ... }]` |
| `track` stamps `timestampUtc` as ISO 8601 | timestamp field is valid ISO 8601 |
| `track` stores caller-supplied properties | `getEvents()[0].properties === { method: 'voice' }` |
| `screen(screenName)` stores as `screen.viewed` | `getEvents()[0].name === 'screen.viewed'` and `properties.screen === screenName` |
| `identify()` does not throw | no-op, no error |
| `reset()` clears buffer and AsyncStorage | `getEvents()` returns `[]` after `reset()` |
| Buffer capped at 500 events | after 501 `track()` calls, `getEvents()` returns 500 events |
| No auto-added PII properties | `getEvents()[0].properties` equals exactly what caller passed |
| Graceful degradation on AsyncStorage error | `track()` does not throw when AsyncStorage fails |

#### Updates to `__tests__/integration/analytics/container.analytics.integration.test.ts`

| Test | Assertion |
|---|---|
| `AsyncStorageAnalyticsAdapter instanceof AnalyticsAdapter` | instanceof check |
| 3-adapter composite fans events to all 3 children | `track` called on noop-A, noop-B, noop-C |

#### Updates to `__tests__/unit/useAnalytics.test.tsx`

| Test | Assertion |
|---|---|
| Resolves `'AnalyticsAdapter'` token | mock container returns `NoopAnalyticsAdapter` |
| `track('event', props)` forwarded | spy on adapter `track` |
| `screen('Screen', props)` forwarded | spy on adapter `screen` |

### Green Phase — implement
1. Create `AsyncStorageAnalyticsAdapter.ts` extending `AnalyticsAdapter`
2. Update `useAnalytics.ts` to resolve `'AnalyticsAdapter'`
3. Update `useScreenView.ts` to call `screen()`
4. Update `registerServices.ts` DI wiring
5. Update all call sites
6. Run `npx tsc --noEmit` — must be clean
7. Run `npm test` — all green

---

## 8. Privacy & Performance Invariants (Preserved from #223)

| Invariant | How preserved |
|---|---|
| **No PII** | Caller-responsibility rule unchanged; `AsyncStorageAnalyticsAdapter` stores only what is passed; `identify()` is a no-op |
| **Fire-and-forget** | `track()` and `screen()` remain synchronous from caller POV; AsyncStorage write is async + silent |
| **No blocking** | No `await` in render paths |
| **Graceful degradation** | AsyncStorage errors silently caught inside `_persist()` |
| **Buffer limit** | 500-event cap with oldest-pruning unchanged |
| **Opt-out** | `CompositeAnalyticsAdapter.optOutProvider` now automatically gates the local adapter alongside Firebase and Mixpanel |

---

## 9. Open Questions

| # | Question | Blocking? | Recommendation |
|---|---|---|---|
| OQ-1 | Should `properties` type on `AnalyticsAdapter.track` be narrowed from `Record<string, unknown>` to `Record<string, string\|number\|boolean>`? Stricter PII-safety at compile time but requires updating Firebase/Mixpanel adapters. | No | Defer — track as a follow-up in a strict-typing issue |
| OQ-2 | Should `getEvents()` / `clearEvents()` be exposed via the DI container for dev tooling / diagnostics screen? | No | Keep as direct class-reference access; expose only if a dev-settings screen is planned |
| OQ-3 | Should `identify()` store a local anonymous session ID for grouping events? | No | No — local-only, no user segmentation required at this stage |
| OQ-4 | Should the old `AsyncStorageAnalyticsService` be deleted in this PR or in a follow-up cleanup PR? | No | Delete in this PR to avoid zombie code |

---

## 10. Acceptance Criteria

| # | Criterion |
|---|---|
| AC-1 | `AsyncStorageAnalyticsAdapter extends AnalyticsAdapter` — confirmed by `instanceof` test |
| AC-2 | `CompositeAnalyticsAdapter` in `registerServices.ts` contains `AsyncStorageAnalyticsAdapter` |
| AC-3 | Opting out via `setOptOutState(true)` suppresses local storage events |
| AC-4 | All call sites use `track(string, object?)` and `screen(string, object?)` |
| AC-5 | `npx tsc --noEmit` passes with no errors |
| AC-6 | `npm test` passes — all analytics unit + integration tests green |
| AC-7 | `IAnalyticsService`, `AsyncStorageAnalyticsService`, and `NullAnalyticsService` are marked `@deprecated` with no new imports pointing to them |
| AC-8 | `'AnalyticsService'` DI token is removed from `registerServices.ts` |

---

## 11. Handoff for Developer

**Reference design docs:**
- This file: `design/issue-223x219-reconciliation.md`
- Original #219 design: `design/issue-219-analytics-monitoring.md`
- Original #223 design: `design/issue-223-ux-instrumentation.md`

**Recommended implementation order (TDD):**

1. Write failing tests in `__tests__/unit/analytics/AsyncStorageAnalyticsAdapter.test.ts` (all red)
2. Create `src/infrastructure/analytics/AsyncStorageAnalyticsAdapter.ts` (make tests green)
3. Update `useAnalytics.ts` and `useScreenView.ts` (update hook tests)
4. Update `registerServices.ts` DI wiring (update integration test)
5. Update all feature-hook call sites (update per-hook analytics tests)
6. Mark deprecated files and run `npx tsc --noEmit` + `npm test`
7. Open PR referencing this design doc

**Do not delete** `IAnalyticsService.ts`, `AsyncStorageAnalyticsService.ts`, or `NullAnalyticsService.ts` until all imports are migrated and TypeScript is clean.
