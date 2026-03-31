# Design: Replace Tab Control with Filter Chips — Payments Screen

**Status**: AWAITING LGTB APPROVAL  
**Author**: Architect Agent  
**Date**: 2026-03-31  
**Branch**: `fix/payments-navigation-context-186`  
**Refs**: Issue #186, related to PR #188 (payments screen redesign) and bug-fix in PR #190

---

## 1. Problem Statement

### 1.1 Background

PR #188 introduced a `PaymentsFilterBar` component — a horizontally segmented pill control
styled as four equal-width tabs (Quotations | Pending | Paid | All). This UI pattern is
visually indistinguishable from a React Navigation tab navigator, which:

1. **Caused navigation crashes** (fixed via a workaround in PR #190) due to NativeWind v4
   wrapping interactive elements with `InteropComponent` when `className=""` (empty string)
   is passed to a `TouchableOpacity`. This created a render-pass misalignment with React
   Navigation v7's `NavigationStateContext` (described in full in
   `design/issue-bugfix-payment-filter-navigation-context-error.md`).
2. **Semantic mismatch**: A tab-style control implies screen navigation. The filter options
   (Pending, Paid, etc.) are content filters — they do not change the screen, they change
   the data displayed. Using a filter chip pattern makes the intent explicit.
3. **Dead code**: `PaymentsSegmentedControl` (Firefighter/Site Manager toggle) is no longer
   used anywhere after the PR #188 redesign. It must be removed.

### 1.2 Current Root-Cause State (as of `master`)

| Bug | Status | Fix applied |
|-----|--------|------------|
| `className=""` NativeWind crash | Fixed in PR #190 via `className={undefined}` | Still fragile — any future contributor could re-introduce `""` |
| Segmented tab appearance (looks like navigation) | Not fixed | `PaymentsFilterBar` still renders as joined tab pills |
| `PaymentsSegmentedControl` dead code | Not removed | File exists but no import anywhere |

### 1.3 Goal

Replace `PaymentsFilterBar` with a `PaymentTypeFilterChips` component that:
- Uses semantically-correct filter chip UI (not tab UI)
- Eliminates NativeWind `className` on all interactive (`Pressable`) elements
- Retains the same `PaymentsFilterOption` type and `useGlobalPaymentsScreen` contract
- Requires no changes to the repository, use-case, or domain layers

---

## 2. User Stories

| # | Story |
|---|-------|
| US-1 | As a Builder, I see **filter chips** (not tabs) at the top of the Finances screen so I understand I'm filtering content, not navigating to a different screen. |
| US-2 | As a Builder, the active filter chip is visually distinct (filled blue background) so I always know which filter is selected. |
| US-3 | As a Builder, I can switch filters without any app crash or flicker. |

---

## 3. Acceptance Criteria

| # | Criterion |
|---|-----------|
| AC-1 | The `PaymentsFilterBar` segment control is **removed** and replaced by `PaymentTypeFilterChips`. |
| AC-2 | `PaymentTypeFilterChips` renders as individual, visually-separated chips (not a connected single-bar pill group). |
| AC-3 | Active chip has a filled primary-blue background (`#3b82f6` dark / `#2563eb` light) with white text. |
| AC-4 | Inactive chips have a transparent background with a border and muted foreground text. |
| AC-5 | **No NativeWind `className` prop is applied to any `Pressable` within the chip row.** All styles use `StyleSheet.create`. |
| AC-6 | The `testID` attribute on each chip matches the existing pattern: `filter-chip-{option}` (updated from `filter-option-{option}`). |
| AC-7 | All four filter options render: **Pending** (default), **Paid**, **Quotations**, **All**. |
| AC-8 | `PaymentsSegmentedControl` component **is deleted**. |
| AC-9 | `PaymentsFilterBar` component **is deleted** (superseded by `PaymentTypeFilterChips`). |
| AC-10 | The quotations query in `useGlobalPaymentsScreen` is gated with `enabled: filter === 'quotations'` to avoid fetching quotation data on every screen mount. |
| AC-11 | Unit tests for `PaymentTypeFilterChips` pass: rendering all 4 chips, calling `onChange` with correct option, active chip style vs inactive chip style. |
| AC-12 | The existing `PaymentsFilterBar.test.tsx` is updated to import and test `PaymentTypeFilterChips`. |
| AC-13 | TypeScript strict mode passes (`npx tsc --noEmit`) with zero new errors. |

---

## 4. Scope

**In Scope**
- New `PaymentTypeFilterChips` component (UI + tests)
- Delete `PaymentsFilterBar` + `PaymentsSegmentedControl`
- Update `PaymentsScreen` (`pages/payments/index.tsx`) to use new component
- Add `enabled` gate to quotations query in `useGlobalPaymentsScreen`
- Update unit test file for the new component

**Out of Scope**
- Any changes to `PaymentCard`, `GlobalQuotationCard`, or list rendering logic
- Changes to `PaymentsNavigator`, navigation params, or routing
- Changes to domain entities or repositories
- Adding badge counts to filter chips (future enhancement)

---

## 5. Architecture Design

### 5.1 Dependency Flow (unchanged)

```
PaymentsScreen (pages/payments/index.tsx)
  └── PaymentTypeFilterChips   ← NEW (replaces PaymentsFilterBar)
        props: value: PaymentsFilterOption, onChange: (option) => void
        NO useNavigation, NO useContext, pure presentational

  └── useGlobalPaymentsScreen  (hook — unchanged contract)
        ├── useGlobalQuotations  ← ADD enabled: filter === 'quotations'
        ├── usePayments (firefighter mode)
        └── TanStack Query (paid payments)
```

### 5.2 Component: `PaymentTypeFilterChips`

**File**: `src/components/payments/PaymentTypeFilterChips.tsx`

```
Props:
  value:    PaymentsFilterOption   ('pending' | 'paid' | 'quotations' | 'all')
  onChange: (option: PaymentsFilterOption) => void

Render tree:
  <ScrollView horizontal showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.row}>  ← horizontal scroll, safe on narrow devices
    {CHIPS.map(chip =>
      <Pressable                         ← NOT TouchableOpacity (no NativeWind interop)
        key={chip.option}
        testID={`filter-chip-${chip.option}`}
        onPress={() => onChange(chip.option)}
        style={[
          styles.chip,
          isActive ? styles.chipActive : styles.chipInactive,
        ]}
      >
        <Text style={[
          styles.label,
          isActive ? styles.labelActive : styles.labelInactive,
        ]}>
          {chip.label}
        </Text>
      </Pressable>
    )}
  </View>
```

**Styling rules (no NativeWind on interactive elements)**:

```typescript
const ACTIVE_BG_LIGHT = '#2563eb';   // blue-600
const ACTIVE_BG_DARK  = '#3b82f6';   // blue-500
const BORDER_LIGHT    = '#d4d4d8';   // zinc-300
const BORDER_DARK     = '#3f3f46';   // zinc-700
const MUTED_TEXT_LIGHT = '#71717a';  // zinc-500
const MUTED_TEXT_DARK  = '#a1a1aa';  // zinc-400

StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,           // pill shape
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: ACTIVE_BG_LIGHT,  // toggled by isDark
    borderColor: ACTIVE_BG_LIGHT,
  },
  chipInactive: {
    backgroundColor: 'transparent',
    borderColor: BORDER_LIGHT,         // toggled by isDark
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,   // mobile-ui confirmed: improves readability at small sizes
    lineHeight: 18,
  },
  labelActive: {
    color: '#ffffff',
  },
  labelInactive: {
    color: MUTED_TEXT_LIGHT,           // toggled by isDark
  },
});
```

> **Note on dark mode**: Because NativeWind is excluded from the interactive element,
> the component receives `isDark: boolean` as a prop (derived from `useColorScheme`
> at the screen level) and passes it down to produce the correct dark/light style
> variants. This is a common safe pattern when opting out of NativeWind on leaf
> interactive components.

### 5.3 Query Optimisation: `useGlobalPaymentsScreen`

The `useGlobalQuotations` hook is called unconditionally today. Since quotation data is
only needed when `filter === 'quotations'`, the query should be gated:

**Change in `useGlobalPaymentsScreen.ts`**:
```typescript
// Before (always fetches quotations):
const { quotations, loading: quotationsLoading, refresh: refreshQuotations } =
  useGlobalQuotations({ vendorSearch: filter === 'quotations' ? search : undefined });

// After (only fetches when tab is active):
const { quotations, loading: quotationsLoading, refresh: refreshQuotations } =
  useGlobalQuotations({
    vendorSearch: filter === 'quotations' ? search : undefined,
    enabled: filter === 'quotations',
  });
```

**Change in `useGlobalQuotations.ts`** — add `enabled` option:
```typescript
export interface UseGlobalQuotationsOptions {
  vendorSearch?: string;
  enabled?: boolean;    // NEW — defaults to true for backward compat
}
// ...
const { data, isFetching } = useQuery({
  queryKey: queryKeys.globalQuotations(),
  queryFn: async () => { ... },
  staleTime: Infinity,
  enabled: options?.enabled ?? true,   // NEW
});
```

### 5.4 Component Deletion

| File | Action |
|------|--------|
| `src/components/payments/PaymentsFilterBar.tsx` | **Delete** |
| `src/components/payments/PaymentsSegmentedControl.tsx` | **Delete** |

---

## 6. Files to Change

| File | Change Type | Description |
|------|-------------|-------------|
| `src/components/payments/PaymentTypeFilterChips.tsx` | **Create** | New filter chip component |
| `src/components/payments/PaymentsFilterBar.tsx` | **Delete** | Replaced by PaymentTypeFilterChips |
| `src/components/payments/PaymentsSegmentedControl.tsx` | **Delete** | Dead code |
| `src/pages/payments/index.tsx` | **Edit** | Import + use `PaymentTypeFilterChips`; pass `isDark` prop |
| `src/hooks/useGlobalPaymentsScreen.ts` | **Edit** | Pass `enabled: filter === 'quotations'` to `useGlobalQuotations` |
| `src/hooks/useGlobalQuotations.ts` | **Edit** | Accept and forward `enabled` option to TanStack Query |
| `__tests__/unit/PaymentsFilterBar.test.tsx` | **Edit** | Update import + testIDs to target `PaymentTypeFilterChips` |

---

## 7. Test Plan

### 7.1 Unit Tests (`__tests__/unit/PaymentsFilterBar.test.tsx` → updated)

| Test ID | Description | Assertion |
|---------|-------------|-----------|
| T-1 | Renders all 4 chip labels | Text children include 'Pending', 'Paid', 'Quotations', 'All' |
| T-2 | Pressing each chip calls `onChange` with correct option | Mock `onChange`; fire `onPress`; verify called argument |
| T-3 | Active chip has filled style; inactive chips have outline style | `style` prop contains the correct `chipActive`/`chipInactive` StyleSheet entry |
| T-4 | No chip passes `className` to its `Pressable` | Snapshot / prop inspection — `className` must be `undefined` on all Pressable nodes |
| T-5 | Renders without crash for all 4 active values | Smoke render for each `value` option |

### 7.2 Existing Tests (no changes needed unless imports break)

- `__tests__/unit/useGlobalPaymentsScreen.test.tsx` — tests are against the hook contract; unaffected by UI change. May need minor update if `useGlobalQuotations` mock needs `enabled` option added.
- `__tests__/unit/payment/sortByPaymentPriority.test.ts` — unaffected
- `__tests__/unit/GlobalQuotationCard.test.tsx` — unaffected

### 7.3 TypeScript Check

```bash
npx tsc --noEmit
```

Must pass with zero new errors before the PR is opened.

---

## 8. UI Design Notes (reviewed with `mobile-ui` agent — decisions finalised)

All decisions below were reviewed and confirmed with the `mobile-ui` agent:

1. **Chip order**: `Pending | Paid | Quotations | All`
   - ✅ Urgency-first ordering aligns with the builder's primary workflow (pending payments most relevant).

2. **Chip layout**: Individual chips inside a `horizontal` `ScrollView` with `showsHorizontalScrollIndicator={false}`.
   - ✅ Future-proofs against additional filter chips; handles narrow devices (iPhone SE) gracefully.
   - Content padding: `paddingHorizontal: 16` on the ScrollView; `gap: 8` between chips.

3. **Border radius**: `borderRadius: 20` (pill/capsule shape).
   - ✅ Clearly differentiates from tab segments (which use `borderRadius: 8` or rectangular shapes).

4. **Icon prefix**: **Omitted**.
   - The search bar immediately below provides sufficient "filter" context; a filter icon would create visual noise.

5. **Active color**: `#2563eb` light / `#3b82f6` dark.
   - ✅ Matches the bottom tab bar active tint (`TabsLayout`) — consistent primary brand accent.

6. **Typography**: `fontSize: 13, fontWeight: '600', letterSpacing: 0.1`.
   - ✅ Compact for 4 chips; slight letter spacing improves readability at small sizes.

---

## 9. Out-of-Scope / Future Enhancements

- Badge counts on chips (e.g., "Pending (3)") — deferred
- Adding more filter types (e.g., "Overdue") — deferred
- Making quotation data pre-fetch in background — deferred

---

## 10. Risks

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| `useGlobalQuotations` `enabled` change breaks existing tests that mock the hook | Low | TanStack Query's `enabled: false` simply doesn't call `queryFn`; mocks should still work |
| Removing `PaymentsFilterBar` breaks an undiscovered import | Low | `grep -r PaymentsFilterBar src/` before deletion |
| NativeWind still applied via outer `View` container className | Accepted | The container `View` (not interactive) uses NativeWind; only the `Pressable` is excluded — this is intentional and safe |

---

_Design document location for developer handoff_: `design/issue-186-payments-filter-chips.md`
