# Design Plan: UX Instrumentation (#223)

**Issue**: [#223 – Add UX instrumentation for user behavior and feature popularity](https://github.com/yhua045/builder-assistant/issues/223)  
**Date**: 2026-05-13  
**Status**: Draft  

---

## 1. Summary

Add a lightweight, privacy-conscious analytics layer to track key user interactions and feature usage across the app. The goal is to understand navigation patterns and feature popularity to drive product decisions — **not** error monitoring or backend logging.

---

## 2. Goals & Acceptance Criteria

| # | Criterion |
|---|-----------|
| AC-1 | Core user interactions are instrumented with consistent, namespaced event names |
| AC-2 | Feature usage can be compared across screens (e.g., Quick Actions usage, Task entry method) |
| AC-3 | Instrumentation does not block or degrade the user experience (fire-and-forget) |
| AC-4 | No personally identifiable information (PII) is collected |
| AC-5 | The analytics interface is pluggable — `NullAnalyticsService` is wired in tests, a real adapter in production |
| AC-6 | Unit tests verify event emission for all instrumented flows |
| AC-7 | Future feature teams can follow the same pattern to add new events |

---

## 3. Tool / Library Evaluation

| Option | Pros | Cons | Decision |
|--------|------|------|----------|
| **AsyncStorage (local-only, custom)** | No new dependencies, full control, fully private, works offline | Data stays on device — no cloud aggregation without extra work | ✅ **Default implementation** |
| PostHog React Native SDK | Open-source, self-hostable, rich dashboards, official RN SDK | Adds `@posthog/react-native` dependency, requires network, needs self-hosted or cloud instance | Optional future adapter |
| Mixpanel / Amplitude | Mature dashboards | SaaS, data leaves device, licensing cost | Not in initial scope |
| **Microsoft Clarity** | Free, Azure-integrated, heatmaps & session replay | **Web-only** — no React Native SDK. Injects a DOM `<script>` tag; not applicable to native views. Session recording also risks PII capture (violates AC-4). | ❌ **Rejected — web-only tool** |
| Azure Application Insights | Azure ecosystem, custom events, free tier | RN SDK limited to crash/error reporting; not designed as a UX/behaviour analytics tool; overkill for local-first event collection | Not in initial scope |
| Sentry | Industry-standard error/crash monitoring | Error monitoring, not UX analytics — different concern entirely | Out of scope (non-goal) |
| Extending existing `AuditLog` | Zero new code | `AuditLog` is project/task-scoped change history — wrong semantic level for UX analytics; would pollute the audit trail | ❌ Rejected |

### Microsoft Clarity — extended rationale

Microsoft Clarity was specifically evaluated given its free tier and Azure integration. It is **not appropriate** for this app for three reasons:

1. **No React Native support.** Clarity is a DOM-based web analytics tool. It works by injecting a JavaScript snippet into HTML pages. A React Native app renders to native iOS/Android views — there is no DOM, no HTML, no `<script>` tag. There is no official Clarity SDK for React Native, and community workarounds involve wrapping the whole app in a `WebView`, which is architecturally unacceptable.

2. **PII risk from session recording.** Clarity's headline feature is session replay with automatic text and interaction recording. Even if a bridge existed, recording native screen content would likely capture project names, financial figures, and contact details — directly violating AC-4.

3. **Wrong tool for the job.** Clarity's value proposition is heatmaps and scroll maps on web pages. Our goal (AC-1, AC-2) is discrete event tracking of feature usage on mobile. PostHog is the correct future upgrade path: it has an official `@posthog/react-native` SDK, supports custom events with no PII by design, and can be self-hosted inside our Azure infrastructure if a cloud dashboard is required later.

**Decision**: Build a pluggable `IAnalyticsService` interface (application layer). Wire `AsyncStorageAnalyticsService` (stores events as JSON in AsyncStorage) for production and `NullAnalyticsService` for tests. Design the infrastructure boundary so a `PostHogAnalyticsService` can be slotted in later with zero changes to domain or UI code.

No new npm dependencies are needed for the initial implementation.

---

## 4. Architecture

### 4.1 Layer Responsibilities

```
Domain            — AnalyticsEvent type (pure data, no deps)
Application       — IAnalyticsService interface (port)
Infrastructure    — AsyncStorageAnalyticsService (adapter)
                    NullAnalyticsService (test/dev stub)
Hooks             — useAnalytics()   → wraps IAnalyticsService for UI
                    useScreenView()  → fires screen_view on mount
DI                — registerServices.ts wires the concrete adapter
```

### 4.2 Dependency Flow (Clean Architecture preserved)

```
Screens / Hooks
     ↓
useAnalytics (hook)
     ↓
IAnalyticsService (application/services/IAnalyticsService.ts)
     ↓
AsyncStorageAnalyticsService (infrastructure/analytics/)
     ↓
@react-native-async-storage/async-storage  ← already in package.json
```

---

## 5. Interface & Type Definitions

### 5.1 `AnalyticsEvent` (domain type)

```ts
// src/domain/analytics/AnalyticsEvent.ts

export interface AnalyticsEvent {
  /** Namespaced event name. Convention: "<feature>.<action>" */
  name: string;
  /** ISO 8601 UTC timestamp */
  timestampUtc: string;
  /** Arbitrary key-value metadata. No PII. */
  properties?: Record<string, string | number | boolean>;
}
```

### 5.2 `IAnalyticsService` (application port)

```ts
// src/application/services/IAnalyticsService.ts

import { AnalyticsEvent } from '../../domain/analytics/AnalyticsEvent';

export interface IAnalyticsService {
  /**
   * Track a discrete user interaction or feature usage event.
   * Must be fire-and-forget — never awaited in UI code.
   */
  track(event: Omit<AnalyticsEvent, 'timestampUtc'>): void;

  /**
   * Convenience: track a screen view (emits a "screen.viewed" event).
   */
  trackScreen(screenName: string, properties?: Record<string, string | number | boolean>): void;

  /**
   * Return a snapshot of buffered events (for debugging / export).
   */
  getEvents(): Promise<AnalyticsEvent[]>;

  /**
   * Clear the local event buffer.
   */
  clearEvents(): Promise<void>;
}
```

### 5.3 `NullAnalyticsService` (test / safe default)

```ts
// src/infrastructure/analytics/NullAnalyticsService.ts

export class NullAnalyticsService implements IAnalyticsService {
  private _events: AnalyticsEvent[] = [];

  track(event: Omit<AnalyticsEvent, 'timestampUtc'>): void {
    this._events.push({ ...event, timestampUtc: new Date().toISOString() });
  }

  trackScreen(screenName: string, properties?: Record<...>): void {
    this.track({ name: 'screen.viewed', properties: { screen: screenName, ...properties } });
  }

  async getEvents(): Promise<AnalyticsEvent[]> { return [...this._events]; }
  async clearEvents(): Promise<void> { this._events = []; }
}
```

### 5.4 `AsyncStorageAnalyticsService` (production adapter)

- Wraps `@react-native-async-storage/async-storage` (already installed).
- Persists events under key `@analytics/events` as a JSON array.
- `track()` is synchronous from the caller's perspective — appends to an in-memory buffer and schedules a debounced write to AsyncStorage (no UI blocking).
- `getEvents()` reads from AsyncStorage.
- `clearEvents()` deletes the key.
- Max buffer: 500 events (oldest pruned). Prevents unbounded growth.

---

## 6. Event Taxonomy

All event names use `<feature>.<verb>` convention with snake_case.

### 6.1 Navigation / Screen Views

| Event Name | When Fired | Key Properties |
|-----------|-----------|---------------|
| `screen.viewed` | On mount of each major screen | `screen: string` |

Screens to instrument: `Dashboard`, `Projects`, `ProjectDetail`, `Tasks`, `TaskDetail`, `Finances`, `Invoices`, `InvoiceDetail`, `Receipts`, `Quotations`, `QuotationDetail`

### 6.2 Dashboard

| Event Name | When Fired | Key Properties |
|-----------|-----------|---------------|
| `dashboard.quick_actions_opened` | FAB tapped → modal opens | — |
| `dashboard.quick_action_selected` | User taps a quick action | `action_id`, `action_title` |
| `dashboard.quick_actions_dismissed` | Modal closed without selection | — |

### 6.3 Task Creation

| Event Name | When Fired | Key Properties |
|-----------|-----------|---------------|
| `task.creation_started` | TaskScreen modal opens | — |
| `task.creation_method_selected` | Voice / Manual / Camera chosen | `method: 'voice' \| 'manual' \| 'camera'` |
| `task.created` | Task saved successfully | `method: 'voice' \| 'manual' \| 'camera'` |
| `task.creation_cancelled` | Modal dismissed | — |

### 6.4 Projects

| Event Name | When Fired | Key Properties |
|-----------|-----------|---------------|
| `project.card_tapped` | ProjectCard pressed | — |
| `project.creation_started` | ManualProjectEntry modal opened | — |
| `project.created` | Project saved | — |

### 6.5 Invoices & Receipts

| Event Name | When Fired | Key Properties |
|-----------|-----------|---------------|
| `invoice.capture_started` | Add Invoice modal opened | — |
| `invoice.created` | Invoice saved | `via_ocr: boolean` |
| `receipt.snap_started` | Snap Receipt modal opened | — |
| `receipt.captured` | Receipt saved | `via_ocr: boolean` |

### 6.6 Quotations

| Event Name | When Fired | Key Properties |
|-----------|-----------|---------------|
| `quotation.creation_started` | QuotationScreen opened | — |
| `quotation.created` | Quotation saved | — |

### 6.7 Critical Path

| Event Name | When Fired | Key Properties |
|-----------|-----------|---------------|
| `critical_path.viewed` | Critical path panel rendered | — |

---

## 7. React Hooks

### 7.1 `useAnalytics` (global singleton hook)

```ts
// src/hooks/useAnalytics.ts
export function useAnalytics(): { track: IAnalyticsService['track']; trackScreen: IAnalyticsService['trackScreen'] }
```

- Resolves `IAnalyticsService` from the tsyringe container (token: `'AnalyticsService'`).
- Wraps calls in `useCallback` to keep referential stability.
- Never throws; errors in the analytics service are caught and silently ignored.

### 7.2 `useScreenView` (automatic screen-view tracking)

```ts
// src/hooks/useScreenView.ts
export function useScreenView(screenName: string, properties?: Record<string, string | number | boolean>): void
```

- Calls `analytics.trackScreen(screenName, properties)` inside `useEffect` on mount.
- No re-fires on re-render. One event per screen mount lifecycle.
- Call at the top of each screen component (or its hook).

---

## 8. DI Registration

```ts
// src/infrastructure/di/registerServices.ts  (addition)
import { AsyncStorageAnalyticsService } from '../analytics/AsyncStorageAnalyticsService';

container.registerSingleton('AnalyticsService', AsyncStorageAnalyticsService);
```

In test setup (`__tests__/utils/container.ts` or jest setup), override with `NullAnalyticsService`.

---

## 9. File Structure

```
src/
├── domain/
│   └── analytics/
│       └── AnalyticsEvent.ts                    ← pure type
├── application/
│   └── services/
│       └── IAnalyticsService.ts                 ← port/interface
├── infrastructure/
│   └── analytics/
│       ├── AsyncStorageAnalyticsService.ts       ← production adapter
│       └── NullAnalyticsService.ts              ← test/dev stub
├── hooks/
│   ├── useAnalytics.ts                          ← resolves from DI
│   └── useScreenView.ts                         ← mount-time screen tracking
```

**Instrumentation call sites** (no new files, edits to existing hooks):

| File | Change |
|------|--------|
| `src/features/dashboard/hooks/useDashboard.ts` | `track` on FAB open, quick action selected/dismissed |
| `src/features/tasks/hooks/useTaskScreen.ts` | `track` on method selection, task created |
| `src/features/projects/hooks/useProjectsPage.ts` | `track` on project card tap, creation started |
| `src/features/invoices/screens/InvoiceScreen.tsx` | `track` on capture started / invoice saved |
| `src/features/receipts/screens/SnapReceiptScreen.tsx` | `track` on snap started / receipt saved |
| `src/features/quotations/screens/QuotationScreen.tsx` | `track` on creation started / saved |
| Each screen (or its hook) | `useScreenView(screenName)` on mount |

---

## 10. TDD Test Plan

### Unit Tests (`__tests__/unit/`)

| Test File | Covers |
|-----------|--------|
| `IAnalyticsService.contract.test.ts` | Contract tests that run against `NullAnalyticsService` — verifies `track`, `trackScreen`, `getEvents`, `clearEvents` |
| `AsyncStorageAnalyticsService.test.ts` | Mock AsyncStorage; verify events are queued, persisted, pruned at 500 limit, no PII leakage |
| `useAnalytics.test.tsx` | Renders hook in isolation; verifies DI resolution + call forwarding |
| `useScreenView.test.tsx` | Renders hook; verifies `trackScreen` is called exactly once on mount, not on re-render |
| `useDashboard.analytics.test.ts` | Spy on `IAnalyticsService`; verify FAB events and quick action events emitted correctly |
| `useTaskScreen.analytics.test.ts` | Verify task creation method events |
| `useProjectsPage.analytics.test.ts` | Verify project card tap and creation events |

### Integration Tests (`__tests__/integration/`)

| Test File | Covers |
|-----------|--------|
| `AsyncStorageAnalyticsService.integration.test.ts` | End-to-end: track → persist → retrieve from AsyncStorage shim |

---

## 11. Privacy & Performance Constraints

- **No PII**: event properties must not include user names, addresses, project names, or financial amounts. Only structural metadata (screen names, action IDs, method types, boolean flags).
- **Fire-and-forget**: `track()` and `trackScreen()` are synchronous from the caller's point of view. The write to AsyncStorage is async and silent.
- **No blocking**: analytics must never be awaited in render paths or use-case critical paths.
- **Graceful degradation**: if AsyncStorage fails, the app continues normally. Errors are caught within the service.
- **Buffer limit**: max 500 events persisted locally. Oldest events are pruned automatically.

---

## 12. Mobile UI Coordination

> **Reviewed with `mobile-ui` agent** (see section below)

UX instrumentation is **non-visual**: no new screens, modals, or UI components are introduced. The changes visible to `mobile-ui` are:

1. `useScreenView(screenName)` added at the top of each screen's hook — purely side-effect, no render impact.
2. `useAnalytics()` added to existing hooks with `track(...)` calls in event handlers — same pattern as existing callbacks, no render changes.
3. No layout, styling, or component tree changes.

**Questions for `mobile-ui` agent:**
- Are there any screens where `useEffect` + mount tracking might conflict with existing animation/transition lifecycle concerns (e.g., modal sheets that re-mount on each open)?
- For the Quick Actions FAB in `DashboardScreen`, should we track the dismissal via backdrop tap differently from the X button tap?

---

## 13. Open Questions

| # | Question | Owner |
|---|----------|-------|
| Q1 | Is there a product analytics backend (PostHog, Amplitude) already provisioned or planned? | Product team |
| Q2 | Should events be exportable from the app (e.g., via dev settings screen)? | Product team |
| Q3 | What is the desired retention period for local events? (Current design: indefinite up to 500 events) | Product team |

---

## 14. Non-Goals (Out of Scope)

- Backend analytics pipeline or cloud dashboard (future work)
- Error/crash monitoring (separate concern — use Sentry or similar)
- Session replay or heatmaps
- A/B testing framework
- Any changes to the `AuditLog` entity or repository

---

## 15. Handoff Notes for Developer

After approval, the developer should:

1. Create `src/domain/analytics/AnalyticsEvent.ts`
2. Create `src/application/services/IAnalyticsService.ts`
3. Create `NullAnalyticsService` — write contract tests first (TDD red)
4. Create `AsyncStorageAnalyticsService` — write unit tests first (TDD red)
5. Register `AsyncStorageAnalyticsService` in `registerServices.ts`
6. Create `useAnalytics` and `useScreenView` hooks — write hook tests first (TDD red)
7. Instrument `useDashboard` (FAB, quick actions) — write tests first (TDD red)
8. Instrument remaining hooks/screens in order of feature priority
9. Run `npx tsc --noEmit` and `npm test` — all green

Reference design doc: `design/issue-223-ux-instrumentation.md`

---

## 16. Reconciliation with Issue #219

**Status**: Fully designed — see [design/issue-223x219-reconciliation.md](issue-223x219-reconciliation.md)

**Context**: Issue #219 (implemented on `master`) introduces an `AnalyticsAdapter` pattern, focusing on macro-level business monitoring with cloud SDKs (Firebase/Mixpanel) and error tracking (Sentry). Issue #223 (this document) introduces an `IAnalyticsService` pattern, focusing on granular, privacy-safe, local on-device UX debugging.

The reconciliation plan (see linked doc) specifies:

1. **Unify the Interface**: Rename `AsyncStorageAnalyticsService` → `AsyncStorageAnalyticsAdapter` and change it to extend the `AnalyticsAdapter` abstract class from Issue #219. `IAnalyticsService` is deprecated with no new consumers.
2. **Combine via Composite**: Add `AsyncStorageAnalyticsAdapter` as the third child in the `CompositeAnalyticsAdapter` array. The existing opt-out gate then automatically covers local storage events.
3. **Update hooks**: `useAnalytics` resolves `'AnalyticsAdapter'` (not `'AnalyticsService'`), returning `track(string, props?)` and `screen(string, props?)`. All call sites update accordingly.
4. **Preserve Granularity & Privacy**: The granular `<feature>.<action>` event taxonomy and strict PII-exclusion rules from #223 are unchanged. The `AsyncStorageAnalyticsAdapter` stores only what callers pass, with no auto-added fields. `identify()` is a no-op.

Full TDD plan, file inventory, and acceptance criteria are in [design/issue-223x219-reconciliation.md](issue-223x219-reconciliation.md).
