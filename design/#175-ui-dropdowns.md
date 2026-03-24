# Design: #175 — UI/UX Refactor: Replace Inline Option Lists with Dropdown Menus

**Issue:** [#175](https://github.com/yhua045/builder-assistant/issues/175)
**Branch:** `feature-issue-175-ui-dropdowns`
**Status:** Draft — Awaiting approval
**Last Updated:** 2026-03-24

---

## 1. User Story

> **As** a builder using the app on a mobile device,
> **I want** single-choice fields to collapse into a compact dropdown/picker,
> **So that** I can see more of the form at once, spend less time scrolling, and make selections with a familiar mobile interaction pattern.

---

## 2. Problem Statement

Several forms currently render multiple-choice fields as a horizontal or wrapping row of `Button` / `TouchableOpacity` chips. This works but has two drawbacks:

1. **Vertical space waste.** Each chip row can expand to 2–3 lines when wrapping occurs (e.g. 8 Australian states, 5 project types).
2. **Inconsistent styling.** `ManualProjectEntryForm` still uses the bare `<Button>` primitive with hard-coded `#007AFF` / `#8E8E93` hex values, while `TaskForm` uses NativeWind chip pills. Neither touchpoint follows the design token system used elsewhere (`border-border`, `bg-card`, `text-foreground`).

---

## 3. Scope

### Phase 1 — Must Do (blocks this PR)

| File | Fields |
|------|--------|
| `src/components/ManualProjectEntryForm.tsx` | **Project Type** (`complete_rebuild`, `extension`, `renovation`, `knockdown_rebuild`, `dual_occupancy`), **State** (`NSW` … `NT`) |

### Phase 2 — Recommended (can be separate PR or included if time allows)

| File | Fields | Notes |
|------|--------|-------|
| `src/components/tasks/TaskForm.tsx` | **Task Type** (3 options), **Status** (5 options), **Priority** (4 options) | Work Type keeps the horizontal chip scroll — it supports a freeform custom entry and is intentionally browseable |
| `src/components/tasks/AddProgressLogModal.tsx` | **Log Type** (7 options) | |
| `src/components/receipts/ReceiptForm.tsx` | **Payment Method** (4 options) | |
| `src/components/quotations/QuotationForm.tsx` | **Status** (4 options) | |

### Out of scope

- Work Type horizontal chip scroller in `TaskForm` (keeps custom-entry UX).
- Any field backed by a free-text `TextInput`.
- Navigation or routing changes.
- Dark mode palette changes beyond what tokens already provide.

---

## 4. Component Design

### 4.1 `<Dropdown />` — Reusable Component

**Location:** `src/components/inputs/Dropdown.tsx`

This keeps the new component alongside the existing `DatePickerInput`, `ContactSelector`, and `ProjectPicker` input components.

#### Props Contract

```typescript
export interface DropdownOption<T extends string = string> {
  label: string;   // Display text
  value: T;        // Stored value
}

export interface DropdownProps<T extends string = string> {
  /** Field label rendered above the trigger */
  label?: string;
  /** Currently selected value */
  value: T | undefined;
  /** Called when the user confirms a selection */
  onChange: (value: T) => void;
  /** Options list */
  options: DropdownOption<T>[];
  /** Placeholder shown when value is undefined */
  placeholder?: string;
  /** Renders an error message below the trigger */
  error?: string;
  /** Disables interaction */
  disabled?: boolean;
  /** testID forwarded to the trigger Pressable */
  testID?: string;
}
```

#### Interaction Model

- **Trigger:** A styled `Pressable` row showing the selected label (or placeholder) and a `ChevronDown` icon on the right. Visually matches `DatePickerInput`'s trigger: `border border-border rounded-lg h-12 px-3 bg-background`.
- **Picker:** A `Modal` (full-screen overlay) with a `FlatList` of `Pressable` rows. Each row shows the option label; the selected item gets a checkmark icon.
- **Dismiss:** Backdrop `Pressable` or "Done" button at the bottom.
- **Accessibility:** `accessibilityRole="combobox"` on the trigger; `accessibilityRole="menuitem"` on each option row.

#### Component Sketch

```
┌─────────────────────────────────────┐
│  Label                              │
│ ┌─────────────────────────────── ▾ ┐│
│ │  Selected Label                  ││
│ └──────────────────────────────────┘│
│  [error message if any]             │
└─────────────────────────────────────┘

  — on press →

┌─────────────────────────────────────┐
│  [Backdrop overlay / Modal]         │
│ ┌─────────────────────────────────┐ │
│ │ ✓  Selected Label               │ │
│ │    Option Two                   │ │
│ │    Option Three                 │ │
│ │    …                            │ │
│ │ ──────────────────────────────  │ │
│ │          [ Done ]               │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 4.2 Styling Tokens

All new UI elements MUST use NativeWind design tokens, NOT raw hex values:

| Purpose | Token |
|---------|-------|
| Trigger border | `border-border` |
| Trigger background | `bg-background` |
| Trigger text | `text-foreground` |
| Placeholder text | `text-muted-foreground` |
| Selected row highlight | `bg-primary/10` |
| Selected row text | `text-primary` |
| Checkmark icon | `text-primary` |
| Modal backdrop | `bg-black/50` |
| Option sheet background | `bg-card` |
| Error text | `text-destructive` |

### 4.3 Usage Example

```tsx
// ManualProjectEntryForm.tsx — After refactor
import Dropdown from './inputs/Dropdown';

const PROJECT_TYPE_OPTIONS = [
  { label: 'Complete Rebuild',   value: 'complete_rebuild'  },
  { label: 'Extension',          value: 'extension'         },
  { label: 'Renovation',         value: 'renovation'        },
  { label: 'Knockdown Rebuild',  value: 'knockdown_rebuild' },
  { label: 'Dual Occupancy',     value: 'dual_occupancy'    },
];

const STATE_OPTIONS = [
  { label: 'NSW', value: 'NSW' }, { label: 'VIC', value: 'VIC' },
  { label: 'QLD', value: 'QLD' }, { label: 'WA',  value: 'WA'  },
  { label: 'SA',  value: 'SA'  }, { label: 'TAS', value: 'TAS' },
  { label: 'ACT', value: 'ACT' }, { label: 'NT',  value: 'NT'  },
];

<Dropdown
  label="Project Type"
  value={projectType}
  onChange={setProjectType}
  options={PROJECT_TYPE_OPTIONS}
  testID="dropdown-project-type"
/>

<Dropdown
  label="State"
  value={state}
  onChange={setStateLoc}
  options={STATE_OPTIONS}
  testID="dropdown-state"
/>
```

---

## 5. Migration Notes

### ManualProjectEntryForm — Current → Target

| # | Current code (lines ~152–174) | Replacement |
|---|-------------------------------|-------------|
| Project Type | `<View className="flex-row gap-2 flex-wrap">` + 5× `<Button>` with hard-coded `color` prop | `<Dropdown options={PROJECT_TYPE_OPTIONS} …/>` |
| State | `<View className="flex-row gap-2 flex-wrap">` + 8× `<Button>` with hard-coded `color` prop | `<Dropdown options={STATE_OPTIONS} …/>` |

- Remove `Button` import from React Native once these are the last usages in the file.
- No changes to validation logic, `handleSave`, or any other state.

### TaskForm — Phase 2 changes

| Field | Current | Replacement |
|-------|---------|-------------|
| Task Type | 3-chip `TouchableOpacity` row | `<Dropdown>` |
| Status | 5-chip wrapping row | `<Dropdown>` |
| Priority | 4-chip wrapping row | `<Dropdown>` |
| Work Type | Horizontal `ScrollView` chips + custom entry | **Keep as-is** |

### Other forms — Phase 2

| File | Field | Change |
|------|-------|--------|
| `AddProgressLogModal` | Log Type (7 chips) | `<Dropdown>` |
| `ReceiptForm` | Payment Method (4 chips) | `<Dropdown>` |
| `QuotationForm` | Status (4 chips) | `<Dropdown>` |

---

## 6. File-Level Change Summary

```
src/
  components/
    inputs/
      Dropdown.tsx          ← NEW: shared component
    ManualProjectEntryForm.tsx  ← Phase 1: replace Project Type + State chips
    tasks/
      TaskForm.tsx          ← Phase 2: replace Task Type, Status, Priority chips
      AddProgressLogModal.tsx  ← Phase 2: replace Log Type chips
    receipts/
      ReceiptForm.tsx       ← Phase 2: replace Payment Method chips
    quotations/
      QuotationForm.tsx     ← Phase 2: replace Status chips
__tests__/
  unit/
    components/
      Dropdown.test.tsx     ← NEW: unit tests
  integration/
    ManualProjectEntryForm.integration.test.tsx  ← update/add for dropdown behaviour
```

---

## 7. Test Acceptance Criteria

All criteria below must be covered by automated tests before the PR can be merged.

### 7.1 `Dropdown` unit tests (`__tests__/unit/components/Dropdown.test.tsx`)

| ID | Scenario | Expected |
|----|----------|----------|
| U1 | Renders trigger with `placeholder` text when `value` is `undefined` | Trigger shows placeholder text |
| U2 | Renders trigger with the matching option `label` when `value` is set | Trigger shows correct label |
| U3 | Pressing the trigger opens the options modal | Modal becomes visible |
| U4 | Pressing an option calls `onChange` with the correct `value` | `onChange` called with e.g. `'NSW'` |
| U5 | Pressing an option closes the modal | Modal becomes invisible |
| U6 | The selected option row shows a checkmark | Row with active `value` contains checkmark indicator |
| U7 | Pressing "Done" / backdrop closes the modal without calling `onChange` | Modal dismissed, `onChange` not called |
| U8 | Renders `error` text below the trigger when `error` prop is set | Error message visible |
| U9 | `disabled` prop prevents the modal from opening | Modal remains hidden after trigger press |
| U10 | `testID` prop is forwarded to the trigger `Pressable` | `getByTestId('dropdown-project-type')` resolves |

### 7.2 `ManualProjectEntryForm` integration tests

| ID | Scenario | Expected |
|----|----------|----------|
| I1 | Default render shows "Complete Rebuild" label in Project Type trigger | Text present without opening modal |
| I2 | Selecting "Renovation" via Project Type dropdown updates state and trigger label | Trigger shows "Renovation" |
| I3 | Selecting "VIC" via State dropdown updates state and trigger label | Trigger shows "VIC" |
| I4 | Form submit after dropdown selection passes `projectType: 'renovation'` and `state: 'VIC'` to `onSave` | `onSave` spy called with correct payload |
| I5 | No hard-coded hex color values remain in the rendered output | `#007AFF` / `#8E8E93` tokens absent |

### 7.3 Accessibility (manual verification checklist)

- [ ] Trigger has `accessibilityRole="combobox"` and `accessibilityLabel` matching the field label.
- [ ] Each option row has `accessibilityRole="menuitem"`.
- [ ] Selected option announces "selected" state via `accessibilityState={{ selected: true }}`.
- [ ] VoiceOver / TalkBack on iOS & Android can open and dismiss the modal without touch.

---

## 8. Open Questions

1. **Native ActionSheet vs Modal FlatList?** On iOS, `ActionSheet` could be used for small option lists (≤ 8 items) for a more platform-native feel. Decision needed before implementation. **Answer**: Use custom `Modal` + `FlatList` for consistent cross-platform behaviour and styling control.
2. **Searchable dropdown (Phase 2+)?** Work Type already has 14+ predefined options and a custom entry. Should Phase 2 add a search filter to `AddProgressLogModal`'s 7 log types? Probably not — defer to a future issue.
3. **Option label display for `complete_rebuild` etc.?** The current form calls `pt.replace('_', ' ')` which yields `"complete rebuild"`. The design doc uses title-cased labels (e.g. `"Complete Rebuild"`). Confirm preferred casing with design. ***Answer: Use title-cased labels for better readability and professionalism. The `Dropdown` component's `options` prop allows us to define user-friendly labels while keeping the underlying values consistent with the existing schema.

---

## 9. Non-Goals / Future Work

- No server/database schema changes required.
- No new navigation routes.
- Multi-select (checkbox list) dropdowns are out of scope for this issue.
