# Design: Issue #219 — Application Monitoring: Firebase + Mixpanel (Analytics) & Sentry (Errors)

**Status**: DRAFT — awaiting review  
**Author**: Copilot (architect mode)  
**Date**: 2026-05-01  
**GitHub Issue**: https://github.com/yhua045/builder-assistant/issues/219  
**Branch**: `issue-219-bdd-tests`

---

## 1. Summary

Add structured application monitoring by integrating:

| Concern | Provider(s) | Purpose |
|---|---|---|
| Product / business event tracking | Firebase Analytics + Mixpanel | Feature usage, user funnels, drop-off analysis |
| **Behavioral application logs** | Mixpanel (primary) | Most-used features, flow completion, where users stop |
| Error & exception reporting | Sentry | Crashes, runtime errors, unhandled rejections |

All three providers are decoupled from application/domain code via the **Adapter pattern** using two abstract classes. The underlying provider can be swapped with zero changes to application code.

---

## 2. Problem Statement

Without analytics or monitoring we cannot answer:

- Which features are actually being used? *(missing)*
- Where do users abandon flows (e.g. invoice creation, quotation submission)? *(missing)*
- At what step in a multi-step flow do users stop or go back? *(missing — application logs requirement)*
- What is the session length / active user count? *(missing)*
- Are there runtime errors or crashes affecting real users? *(missing)*

### 2.1 Missing Requirement: Application Behavioral Logs

Beyond simple event counts, we need **behavioral analytics** to answer:

1. **Most-used features** — ranked by event frequency across sessions
2. **User funnels** — ordered step sequences for key flows (Invoice, Quotation, Task, Receipt Scan)
3. **Drop-off points** — which step in a funnel causes users to abandon
4. **Re-entry patterns** — do users who abandon return to complete the same flow later?

These are served by the same `AnalyticsAdapter` but require a **structured event taxonomy** and **explicit funnel event pairs** (`*_started` / `*_completed` / `*_abandoned`).

---

## 3. Chosen Stack

| Layer | Library | Package | License / Cost |
|---|---|---|---|
| Analytics | Firebase Analytics | `@react-native-firebase/app` + `@react-native-firebase/analytics` | Free |
| Analytics | Mixpanel | `mixpanel-react-native` | Free |
| Error Reporting | Sentry | `@sentry/react-native` | Free (5 k errors/month) |

**Rationale for both Firebase + Mixpanel:**
- Firebase provides cheap session/retention/DAU metrics and screen_view out of the box.
- Mixpanel provides first-class funnel and cohort analysis — essential for the behavioral log requirement.
- Both are driven by the same `CompositeAnalyticsAdapter`, so there is zero duplication in application code.

---

## 4. Architecture

### 4.1 Adapter Abstractions (Infrastructure Layer)

All files live in `src/infrastructure/analytics/`.

```
src/infrastructure/analytics/
├── AnalyticsAdapter.ts           ← abstract class
├── ErrorReportingAdapter.ts      ← abstract class
├── NoopAnalyticsAdapter.ts       ← in-memory stub for tests & opt-out
├── NoopErrorReportingAdapter.ts  ← in-memory stub for tests
├── FirebaseAnalyticsAdapter.ts   ← wraps @react-native-firebase/analytics
├── MixpanelAnalyticsAdapter.ts   ← wraps mixpanel-react-native
├── CompositeAnalyticsAdapter.ts  ← fans out to Firebase + Mixpanel
└── SentryErrorReportingAdapter.ts← wraps @sentry/react-native
```

#### `AnalyticsAdapter` (abstract)

```typescript
abstract class AnalyticsAdapter {
  abstract identify(userId: string, traits?: Record<string, unknown>): void;
  abstract track(event: string, properties?: Record<string, unknown>): void;
  abstract screen(screenName: string, properties?: Record<string, unknown>): void;
  abstract reset(): void;
}
```

#### `ErrorReportingAdapter` (abstract)

```typescript
abstract class ErrorReportingAdapter {
  abstract captureException(error: Error, context?: Record<string, unknown>): void;
  abstract captureMessage(message: string, level?: 'info' | 'warning' | 'error'): void;
  abstract setUser(userId: string): void;
  abstract clearUser(): void;
}
```

#### `CompositeAnalyticsAdapter`

Fans all calls to both `FirebaseAnalyticsAdapter` and `MixpanelAnalyticsAdapter`. Checks the opt-out flag before dispatching — if the user has opted out, all calls are silently dropped.

```typescript
class CompositeAnalyticsAdapter extends AnalyticsAdapter {
  constructor(
    private readonly adapters: AnalyticsAdapter[],
    private readonly optOutProvider: () => boolean,
  ) {}

  track(event: string, properties?: Record<string, unknown>) {
    if (this.optOutProvider()) return;
    this.adapters.forEach(a => a.track(event, properties));
  }
  // ... same pattern for identify, screen, reset
}
```

### 4.2 DI Registration

Both adapters are registered as singletons in `src/infrastructure/di/registerServices.ts`:

```typescript
container.registerSingleton('AnalyticsAdapter', CompositeAnalyticsAdapter);
container.registerSingleton('ErrorReportingAdapter', SentryErrorReportingAdapter);
```

In tests, `NoopAnalyticsAdapter` and `NoopErrorReportingAdapter` are substituted.

### 4.3 Analytics Opt-Out

An opt-out preference is persisted via `@react-native-async-storage/async-storage` (already installed) under the key `analytics_opt_out`.

```
src/hooks/useAnalyticsOptOut.ts     ← reads/writes AsyncStorage; exposes { isOptedOut, setOptOut }
```

The `CompositeAnalyticsAdapter` receives the opt-out state via an injected `optOutProvider: () => boolean` function, evaluated on each call to keep it reactive without re-instantiating the adapter.

---

## 5. Behavioral Event Taxonomy (Application Logs)

This is the structured event catalog that satisfies the **application behavioral logs** requirement. Every event is in `snake_case`. No PII is ever included.

### 5.1 Screen View Events

Fired via `AnalyticsAdapter.screen()` on each tab/screen mount.

| Screen Name | Where fired |
|---|---|
| `Dashboard` | `DashboardScreen` on mount |
| `Tasks` | `TaskScreen` on mount |
| `Invoices` | `InvoiceScreen` on mount |
| `Quotations` | `QuotationsScreen` on mount |
| `Payments` | `PaymentsScreen` on mount |
| `SnapReceipt` | `SnapReceiptScreen` on mount |
| `Profile` | `ProfileScreen` on mount |
| `TaskDetail` | `TaskDetailsPage` on mount |
| `InvoiceDetail` | `InvoiceDetailPage` on mount |
| `PaymentDetail` | `PaymentDetails` on mount |

**Why**: screen view frequency identifies the most-visited features without any explicit funnel definition. This answers "most used features" at the screen level.

### 5.2 Feature Usage Events

Fired via `AnalyticsAdapter.track()` from use-case hooks when an action succeeds.

| Event | Properties | Source |
|---|---|---|
| `task_created` | `{ projectId? }` | `CreateTaskUseCase` |
| `task_completed` | `{ projectId? }` | `CompleteTaskUseCase` |
| `task_deleted` | — | `DeleteTaskUseCase` |
| `task_blocker_added` | — | `AddDelayReasonUseCase` |
| `invoice_created` | `{ projectId? }` | `CreateInvoiceUseCase` |
| `invoice_submitted` | `{ projectId? }` | `MarkInvoiceAsPaidUseCase` |
| `invoice_cancelled` | — | `CancelInvoiceUseCase` |
| `quotation_created` | `{ projectId? }` | `CreateQuotationUseCase` |
| `quotation_accepted` | `{ projectId? }` | `AcceptQuotationUseCase` |
| `quotation_declined` | — | `DeclineQuotationUseCase` |
| `payment_recorded` | `{ projectId? }` | `RecordPaymentUseCase` |
| `payment_marked_paid` | `{ projectId? }` | `MarkPaymentAsPaidUseCase` |
| `receipt_scan_initiated` | — | `SnapReceiptScreen` |
| `receipt_scan_completed` | `{ method: 'camera' \| 'gallery' }` | `CreateTaskFromPhotoUseCase` |
| `project_created` | — | `CreateProjectUseCase` (existing) |
| `project_opened` | — | project detail navigation |
| `audit_log_entry_created` | — | `CreateAuditLogEntryUseCase` |

### 5.3 User Funnel Events (Drop-off Detection)

Funnel start/complete/abandoned triplets enable Mixpanel's funnel analysis. These directly address the "where do users stop in a specific feature" requirement.

| Funnel | Step Events |
|---|---|
| **Invoice Creation** | `invoice_creation_started` → `invoice_creation_completed` / `invoice_creation_abandoned` |
| **Quotation Creation** | `quotation_creation_started` → `quotation_creation_completed` / `quotation_creation_abandoned` |
| **Task Creation** | `task_creation_started` → `task_creation_completed` / `task_creation_abandoned` |
| **Receipt OCR Scan** | `receipt_scan_initiated` → `receipt_scan_completed` / `receipt_scan_failed` |
| **Payment Recording** | `payment_recording_started` → `payment_recording_completed` / `payment_recording_abandoned` |

**Implementation pattern**: `*_started` is fired when the create/edit form mounts. `*_completed` is fired after successful use-case execution. `*_abandoned` is fired when the form unmounts without completion (via `useEffect` cleanup or `blur` navigation event).

### 5.4 Session & Engagement Events

| Event | Properties | Purpose |
|---|---|---|
| `app_session_started` | `{ timestamp }` | Session length baseline |
| `feature_search_performed` | `{ query_length: number }` | QuickLookup usage |

---

## 6. Error Monitoring

`ErrorReportingAdapter` is wired into:

| Location | What is captured |
|---|---|
| `ErrorBoundary` (new global wrapper in `App.tsx`) | React render errors |
| `App.tsx` — `Promise.onUnhandledRejection` | Unhandled promise rejections |
| `ProcessInvoiceUploadUseCase` catch block | OCR / PDF parse failures |
| `ProcessQuotationUploadUseCase` catch block | OCR / PDF parse failures |
| `CreateTaskFromPhotoUseCase` catch block | Camera/OCR failures |
| `GroqSTTAdapter` catch block | Voice transcription failures |

---

## 7. UI Changes — Analytics Opt-Out Toggle

> **Mobile-UI Consultation Required**

A new **Privacy** section is added to `src/pages/profile/index.tsx` below the existing settings items.

### 7.1 Proposed component sketch

```tsx
// New section in ProfileScreen
<View className="bg-card rounded-2xl p-6 mb-6">
  <Text className="text-foreground font-semibold text-base mb-4">Privacy</Text>
  <View className="flex-row items-center justify-between">
    <View className="flex-1 mr-4">
      <Text className="text-foreground font-medium">Analytics & Crash Reports</Text>
      <Text className="text-muted-foreground text-sm mt-0.5">
        Help improve the app by sharing usage data
      </Text>
    </View>
    <Switch
      value={!isOptedOut}
      onValueChange={(v) => setOptOut(!v)}
      trackColor={{ false: '#767577', true: primaryColor }}
      thumbColor="#ffffff"
    />
  </View>
</View>
```

### 7.2 Questions for `mobile-ui` agent

1. **Placement**: Should the Privacy section appear (a) below the existing Account/Settings items, or (b) as its own card at the bottom of the scroll area above the log-out button?
2. **Toggle component**: The existing `MenuItem` uses `TouchableOpacity` + chevron. Should the toggle use RN `Switch`, or a custom `BooleanMenuItem` that matches the rounded-xl card style already used?
3. **Primary color reference**: What is the correct NativeWind token for the `trackColor` true-state on `Switch` (to match the app's `bg-primary` color)?

> **mobile-ui response** *(pending)* — Consultation logged; no blocking on design doc. Implementation will be adjusted based on response before the first PR.

---

## 8. Implementation Phases

### Phase 1 — Adapter Abstractions & Tests (TDD)

1. Write **failing unit tests** in `__tests__/unit/analytics/`:
   - `AnalyticsAdapter.contract.test.ts` — assert the abstract contract shape
   - `CompositeAnalyticsAdapter.test.ts` — fan-out, opt-out suppression
   - `NoopAnalyticsAdapter.test.ts` — silent no-op behaviour
   - `ErrorReportingAdapter.contract.test.ts`
   - `NoopErrorReportingAdapter.test.ts`
2. Implement abstract classes, `NoopAnalyticsAdapter`, `NoopErrorReportingAdapter`, and `CompositeAnalyticsAdapter`.
3. Write **failing unit tests** for concrete adapters using mocked SDKs:
   - `FirebaseAnalyticsAdapter.test.ts` (mock `@react-native-firebase/analytics`)
   - `MixpanelAnalyticsAdapter.test.ts` (mock `mixpanel-react-native`)
   - `SentryErrorReportingAdapter.test.ts` (mock `@sentry/react-native`)
4. Implement concrete adapters.
5. Write **DI integration test**: container resolves correct singleton types.

### Phase 2 — SDK Installation & Configuration

1. `npm install @react-native-firebase/app @react-native-firebase/analytics`
2. `npm install mixpanel-react-native`
3. `npm install @sentry/react-native`
4. Add native config: `google-services.json` / `GoogleService-Info.plist`
5. Add env vars to `.env.example`:
   ```
   MIXPANEL_TOKEN=
   SENTRY_DSN=
   ANALYTICS_ENABLED=true
   ```
6. Register adapters in `registerServices.ts`.

### Phase 3 — Screen View Instrumentation

Wire `AnalyticsAdapter.screen()` into each main screen component via a shared hook:

```typescript
// src/hooks/useScreenTracking.ts
export function useScreenTracking(screenName: string) {
  const analytics = useMemo(() => container.resolve<AnalyticsAdapter>('AnalyticsAdapter'), []);
  useEffect(() => {
    analytics.screen(screenName);
  }, [analytics, screenName]);
}
```

Add `useScreenTracking('Dashboard')` etc. to each screen listed in §5.1.

### Phase 4 — Feature Event & Funnel Instrumentation

Wire `AnalyticsAdapter.track()` events into:
- Feature-level hooks (e.g. `useCreateTask`, `useCreateInvoice`)
- Form-level mount/unmount for funnel start/abandoned events
- Follows the event taxonomy in §5.2 and §5.3.

### Phase 5 — Error Monitoring

1. Create `src/components/shared/ErrorBoundary.tsx` (React class component).
2. Wrap `<NavigationContainer>` in `App.tsx` with `<ErrorBoundary>`.
3. Add `Promise.onUnhandledRejection` handler in `App.tsx`.
4. Add `captureException` calls to use-case catch blocks listed in §6.

### Phase 6 — Opt-Out Toggle UI

1. Create `src/hooks/useAnalyticsOptOut.ts`.
2. Add Privacy section to `src/pages/profile/index.tsx` (per mobile-ui consultation outcome).

### Phase 7 — Dashboards (External — No Code)

- Firebase Analytics: DAU, screen_view, retention cohorts
- Mixpanel: define funnels matching the §5.3 triplets; build drop-off visualisations
- Sentry: error rate, top exceptions, affected sessions

---

## 9. TDD Test Plan

### 9.1 Unit Tests (`__tests__/unit/analytics/`)

| File | What it asserts |
|---|---|
| `CompositeAnalyticsAdapter.test.ts` | Calls are forwarded to all child adapters; all calls are suppressed when opt-out returns true |
| `FirebaseAnalyticsAdapter.test.ts` | `logEvent` called on firebase module with correct params; `logScreenView` for `screen()` |
| `MixpanelAnalyticsAdapter.test.ts` | `Mixpanel.track` called with correct event + properties; `identify` maps to Mixpanel `identify` |
| `SentryErrorReportingAdapter.test.ts` | `Sentry.captureException` / `captureMessage` forwarded with correct level |
| `useAnalyticsOptOut.test.ts` | `AsyncStorage.setItem` called on opt-out; `getItem` initialises state correctly |
| `useScreenTracking.test.ts` | Calls `analytics.screen(screenName)` on mount; does not call on unmount |

### 9.2 Integration Tests (`__tests__/integration/analytics/`)

| File | What it asserts |
|---|---|
| `container.analytics.integration.test.ts` | `container.resolve('AnalyticsAdapter')` returns a `CompositeAnalyticsAdapter` in production config; `NoopAnalyticsAdapter` in test config |

### 9.3 BDD Scenarios (`__tests__/bdd/features/analytics/`)

```gherkin
Feature: User behavior tracking
  Background:
    Given the user has not opted out of analytics

  Scenario: Screen view is tracked when user navigates to a screen
    Given the analytics adapter is initialised
    When the user navigates to the "Invoices" screen
    Then a screen view event "Invoices" is recorded

  Scenario: Feature event is tracked when user creates a task
    Given the analytics adapter is initialised
    When the user successfully creates a task
    Then a "task_created" event is tracked

  Scenario: Invoice creation funnel tracks start and completion
    When the user opens the invoice creation form
    Then an "invoice_creation_started" event is tracked
    When the user submits the invoice form
    Then an "invoice_creation_completed" event is tracked

  Scenario: Invoice creation funnel tracks abandonment
    When the user opens the invoice creation form
    And the user navigates away without submitting
    Then an "invoice_creation_abandoned" event is tracked

  Scenario: No events are sent when the user has opted out
    Given the user has opted out of analytics
    When the user navigates to the "Dashboard" screen
    And the user creates a task
    Then no analytics events are recorded

  Scenario: Errors are reported to Sentry
    Given an unhandled error occurs in the app
    Then the error reporting adapter captures the exception
```

---

## 10. Acceptance Criteria

| # | Criterion | Phase |
|---|---|---|
| AC-1 | `AnalyticsAdapter` and `ErrorReportingAdapter` abstract classes exist with zero direct SDK imports in application/domain code | 1 |
| AC-2 | `CompositeAnalyticsAdapter` fans events to all child adapters simultaneously | 1 |
| AC-3 | All 9 main screen views are tracked via `useScreenTracking` | 3 |
| AC-4 | At least 12 feature-usage events are instrumented (§5.2) | 4 |
| AC-5 | Funnel start/complete/abandoned triplets exist for all 5 funnels in §5.3 | 4 |
| AC-6 | Errors and unhandled exceptions are reported to Sentry | 5 |
| AC-7 | Analytics opt-out toggle persists to `AsyncStorage` and suppresses all events | 6 |
| AC-8 | No PII (name, email, phone) is ever passed to any provider | 1–6 |
| AC-9 | TypeScript strict mode passes (`npx tsc --noEmit`) | 1–6 |
| AC-10 | All existing unit/integration tests pass (`npm test`) | 1–6 |
| AC-11 | BDD scenarios for analytics pass via `jest-cucumber` | 1–6 |
| AC-12 | `.env.example` contains `MIXPANEL_TOKEN`, `SENTRY_DSN`, `ANALYTICS_ENABLED` placeholders | 2 |

---

## 11. File Structure (New Files)

```
src/
└── infrastructure/
    └── analytics/
        ├── AnalyticsAdapter.ts
        ├── ErrorReportingAdapter.ts
        ├── NoopAnalyticsAdapter.ts
        ├── NoopErrorReportingAdapter.ts
        ├── FirebaseAnalyticsAdapter.ts
        ├── MixpanelAnalyticsAdapter.ts
        ├── CompositeAnalyticsAdapter.ts
        └── SentryErrorReportingAdapter.ts

src/
├── hooks/
│   ├── useAnalyticsOptOut.ts
│   └── useScreenTracking.ts
└── components/
    └── shared/
        └── ErrorBoundary.tsx

__tests__/
├── unit/
│   └── analytics/
│       ├── CompositeAnalyticsAdapter.test.ts
│       ├── FirebaseAnalyticsAdapter.test.ts
│       ├── MixpanelAnalyticsAdapter.test.ts
│       ├── SentryErrorReportingAdapter.test.ts
│       ├── useAnalyticsOptOut.test.ts
│       └── useScreenTracking.test.ts
├── integration/
│   └── analytics/
│       └── container.analytics.integration.test.ts
└── bdd/
    ├── features/
    │   └── analytics/
    │       └── user-behavior-tracking.feature
    └── steps/
        └── analytics/
            └── user-behavior-tracking.steps.ts
```

---

## 12. Non-Functional Requirements

| Requirement | Detail |
|---|---|
| **PII-free** | No user names, emails, phone numbers, addresses, or financial amounts may be sent to any analytics provider |
| **App Store compliance** | Opt-out toggle required by Apple App Store (iOS 14.5+) and Google Play privacy policies |
| **Performance** | Adapter calls are fire-and-forget; no `await` in the call chain from use cases or hooks |
| **Testability** | `NoopAnalyticsAdapter` and `NoopErrorReportingAdapter` are the only adapters used in unit/integration tests |
| **Feature flag** | `ANALYTICS_ENABLED` env var allows disabling all telemetry in CI or development builds |

---

## 13. Open Questions

1. **User identity**: The current app has no authentication. When a real user identity is introduced, `AnalyticsAdapter.identify()` and `ErrorReportingAdapter.setUser()` calls should be wired into the auth flow. For now, a random anonymous UUID (generated once, stored in `AsyncStorage`) is used as the identifier.
2. **Funnel abandonment timing**: How many seconds of inactivity (or explicit back-navigation) should trigger `*_abandoned`? Propose: fire on screen unmount if `*_completed` was not already fired in the same mount lifecycle.
3. **`ANALYTICS_ENABLED` flag scope**: Should this be a build-time Metro flag (`.env`) or a runtime flag (AsyncStorage)? Propose: `.env` for CI/dev, `AsyncStorage` for user opt-out — both checks in `CompositeAnalyticsAdapter`.

---

## 14. References

- GitHub Issue: https://github.com/yhua045/builder-assistant/issues/219
- Related BDD setup: [design/issue-217-bdd-tests.md](issue-217-bdd-tests.md)
- Feature flags pattern: `src/config/featureFlags.ts`
- DI container: `src/infrastructure/di/container.ts`, `registerServices.ts`
- Profile screen: `src/pages/profile/index.tsx`
- CLAUDE.md TDD guidelines: Section "Test-Driven Development (TDD) Workflow"
