# Design: Bug Fix — Payment Filter Causes "NavigationStateContext" Crash

**Status**: READY FOR DEVELOPER  
**Author**: Architect Agent  
**Date**: 2026-03-30  
**Refs**: Issue #188 (`feature/issue-188-payments-screen`)  
**Branch**: TBD — created by `setup` agent before implementation

---

## 1. Bug Description

Clicking any payment type filter pill (Paid, Quotations, Pending, All) in the `PaymentsScreen`
produces a hard runtime crash:

```
Couldn't find a navigation context.
Have you wrapped your app with NavigationContainer?
```

Stack trace mentions:
- `NavigationStateContext.js`
- `render-component` (React Navigation v7 screen wrapper)
- `nativewind interop around TouchableOpacity`

---

## 2. Root Cause Analysis

### 2.1 Primary Root Cause — Dynamic Empty-String `className` on `TouchableOpacity`

**File**: `src/components/payments/PaymentsFilterBar.tsx`  
**Line**: `className={active ? 'bg-card rounded-lg shadow-sm' : ''}`

In NativeWind v4 (react-native-css-interop), when `className` is applied to a core
React Native component (`TouchableOpacity`), the library wraps it in an `InteropComponent`.
This InteropComponent uses a React Context internally to resolve CSS variables and dark-mode
tokens.

The problem occurs with an alternating `className` value:
- `inactive state` → `className=""` (empty string)
- `active state`   → `className="bg-card rounded-lg shadow-sm"` (non-empty)

With NativeWind v4 + React 19 (concurrent features) + React Navigation v7:

1. Each filter button press calls `onChange(option)` → `setFilter(option)` (a React state
   setter).
2. React 19 schedules an **interruptible re-render** of `PaymentsScreen` and all its children.
3. During the re-render, NativeWind's `InteropComponent` wrapper detects the `className`
   change from `""` to `"bg-card rounded-lg shadow-sm"` (or vice versa).
4. NativeWind v4 treats an **empty string `className`** as a distinct case from a
   non-empty one. The InteropComponent may trigger a secondary synchronous update
   (or flush a layout effect) that creates a new render pass inside the NativeWind
   stylesheet context.
5. This secondary NativeWind-initiated render pass executes **within the React Navigation
   v7 screen `render-component` boundary** but at a point where React Navigation v7's
   context providers have not yet re-established the `NavigationStateContext` for the
   current render cycle (a known React 19 "context tearing" edge case with
   `useContext`-based libraries when mixed with interleaved renders from third-party
   wrapper components).
6. `PaymentsScreen` calls `useNavigation()` which reads `NavigationStateContext`. When
   this read happens during the mis-timed secondary render pass, the context is absent
   → crash.

**Why `className=""` vs `className={undefined}`** is the trigger: NativeWind v4 always
creates the InteropComponent wrapper when the `className` prop key is **present** on the
element, even if its value is an empty string. Passing `undefined` (or omitting the prop
entirely) would allow React Navigation's context to propagate cleanly because no
NativeWind wrapper is created. Passing `""` creates the wrapper but with no styles, which
causes the render-pass misalignment above.

### 2.2 Secondary Bug — `navigate('QuotationDetail')` Targets a Screen Outside `PaymentsNavigator`

**File**: `src/pages/payments/index.tsx`  
**Line**: `navigation.navigate('QuotationDetail', { quotationId: q.id })`

Navigation hierarchy:
```
NavigationContainer
  └── TabsLayout (Tab.Navigator)
        ├── Dashboard tab → DashboardScreen
        ├── Finances tab  → PaymentsNavigator
        │     ├── PaymentsList (PaymentsScreen)    ← useNavigation is here
        │     └── PaymentDetails
        ├── Work tab      → TasksNavigator
        └── Projects tab  → ProjectsNavigator
              └── QuotationDetail  ← target screen lives here, NOT in PaymentsNavigator
```

`navigation.navigate('QuotationDetail', ...)` dispatched from `PaymentsNavigator` will:
1. Check `PaymentsNavigator` for the route — **not found**
2. Check parent `Tab.Navigator` — **not found**
3. React Navigation v7 throws (in v7 vs v6 this may manifest differently, but it is
   still a crash)

This secondary bug would crash the app when a user **taps a quotation card** after
switching to the Quotations filter — a separate but related crash path.

---

## 3. Files to Change

| File | Change type | Reason |
|---|---|---|
| `src/components/payments/PaymentsFilterBar.tsx` | Edit | Replace `className=""` inactive state with `className={undefined}` to avoid empty-string NativeWind interop wrapper (primary bug fix) |
| `src/pages/payments/index.tsx` | Edit | Fix cross-navigator `navigate('QuotationDetail')` to use correct cross-tab routing (secondary bug fix) |
| `src/pages/payments/PaymentsNavigator.tsx` | Edit | *(Option A)* Add `QuotationDetail` screen to `PaymentsNavigator` to keep navigation self-contained |

---

## 4. Minimal Implementation Plan

### Fix A — `PaymentsFilterBar.tsx` (primary crash)

**Change**: Replace the ternary `className` with a pattern that avoids passing an empty
string. Two safe options:

**Option 1 — `className={undefined}` for inactive** (preferred, zero-style overhead):
```tsx
className={active ? 'bg-card rounded-lg shadow-sm' : undefined}
```

**Option 2 — Move conditional to `style` prop instead** (equally correct, explicit):
Remove `className` from the inactive button entirely and use `StyleSheet.create` for the
active background:
```tsx
// No className on TouchableOpacity at all
style={[styles.segment, active && styles.activeSegment]}
```
Where `styles.activeSegment = { backgroundColor: '#ffffff', borderRadius: 8, ... }`.

Option 1 is the minimal diff. Option 2 is more explicit and avoids nativewind on this
component entirely.

### Fix B — `PaymentsScreen` (`index.tsx`) + `PaymentsNavigator.tsx` (secondary crash)

**Chosen approach**: Register `QuotationDetail` inside `PaymentsNavigator` as a pushed
screen. This is the cleanest fix because quotation detail is a natural detail screen in
the Finances flow and keeps navigation self-contained.

**`PaymentsNavigator.tsx`**: Add `QuotationDetail` screen:
```typescript
export type PaymentsStackParamList = {
  PaymentsList: undefined;
  PaymentDetails: { paymentId?: string; syntheticRow?: Payment };
  QuotationDetail: { quotationId: string };   // NEW
};
// ...
<Stack.Screen name="QuotationDetail" component={QuotationDetailScreen} />
```

**`PaymentsScreen` (`index.tsx`)**: The existing `navigation.navigate('QuotationDetail', ...)`
call is already correct once the route is registered.

> If the product intention is instead to land on the QuotationDetail screen inside the
> Projects tab context, use cross-navigator navigation:
> ```ts
> navigation.navigate('Projects', {
>   screen: 'QuotationDetail',
>   params: { quotationId: q.id },
> });
> ```
> This is a product decision — both are technically valid. Registering the screen in
> `PaymentsNavigator` is recommended because it keeps the "Finances" UX self-contained
> and avoids switching the user to the Projects tab.

---

## 5. Validation Plan

### Unit tests (add to `__tests__/unit/PaymentsFilterBar.test.tsx`)

| Test | Assertion |
|---|---|
| Filter bar does not pass `className=""` to any `TouchableOpacity` | Snapshot / props inspection |
| Pressing an inactive filter pill calls `onChange` with correct option | Mock `onChange`, simulate press |
| Active pill gets active style class; inactive pills get `undefined` className | Per-pill props snapshot |

### Integration tests (add to `__tests__/integration/PaymentsScreen.integration.test.tsx`)

| Test | Assertion |
|---|---|
| Switching filters does not throw a navigation context error | Wrapped in mock NavigationContainer; no error thrown on filter press |
| Switching to `quotations` filter renders `GlobalQuotationCard` items | Data-driven; mock `useGlobalPaymentsScreen` |
| Tapping a `GlobalQuotationCard` calls `navigation.navigate('QuotationDetail', ...)` | Mock `useNavigation`; simulate press |

### Manual on-device (iOS Simulator)

1. Open the **Finances** tab.
2. Tap each filter pill (Quotations → Pending → Paid → All) rapidly — **no crash**.
3. Switch to the Quotations filter; verify quotation cards render.
4. Tap a quotation card — verify navigation to `QuotationDetail` screen (no crash).
5. Press back — returns to `PaymentsScreen` with Quotations filter still selected.
6. Verify dark-mode: active pill background visible in both light and dark themes.

### TypeScript check
```bash
npx tsc --noEmit
```
No new errors.

---

## 6. Acceptance Criteria

- [ ] Pressing any filter pill (Paid, Quotations, Pending, All) does **not** crash the app.
- [ ] `PaymentsFilterBar` inactive `TouchableOpacity` buttons never receive `className=""`.
- [ ] Tapping a `GlobalQuotationCard` navigates to `QuotationDetail` without crash.
- [ ] TypeScript strict-mode check passes with zero new errors.
- [ ] Unit tests for `PaymentsFilterBar` active/inactive className are green.
- [ ] Integration test for filter switching without navigation context error is green.

---

## 7. Out of Scope

- Redesigning `PaymentsFilterBar` beyond the className fix.
- Adding `QuotationDetail` to the Projects-tab context links from PaymentsScreen.
- Any styling changes beyond what is needed to eliminate the empty-string `className`.
