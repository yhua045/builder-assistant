# Design: #179 — UI Adjustment: Revert Dropdowns for Short Option Lists

**Issue:** [#179](https://github.com/yhua045/builder-assistant/issues/179)
**Branch:** `feature-issue-179-revert-dropdowns`
**Status:** Approved
**Last Updated:** 2026-03-25

---

## 1. User Story

> **As** a builder filling in a form on a mobile device,
> **I want** multiple-choice fields with only a few options to display as
> tappable inline chips rather than a modal dropdown,
> **So that** I can see and pick from all options at a glance without the
> overhead of opening a picker sheet.

---

## 2. Context & Problem Statement

Issue [#175](https://github.com/yhua045/builder-assistant/issues/175) replaced
inline option chips with the `<Dropdown>` modal-picker component across all
multiple-choice fields. While that trade-off is worth it for long lists (e.g.
the 8 Australian states), it is counter-productive for short lists (≤ 5 items)
where the overhead of tapping-to-open, scrolling, and dismissing outweighs the
vertical space saved.

**Affected option sets today (post-#175):**

| File | Field | Count | Action |
|------|-------|-------|--------|
| `ManualProjectEntryForm.tsx` | Project Type | 5 | → `OptionList` |
| `ManualProjectEntryForm.tsx` | State | 8 | keep `Dropdown` |
| `TaskForm.tsx` | Task Type | 3 | → `OptionList` |
| `TaskForm.tsx` | Status | 5 | → `OptionList` |
| `TaskForm.tsx` | Priority | 4 | → `OptionList` |
| `AddProgressLogModal.tsx` | Log Type | 7 | → `OptionList` (per request) |
| `ReceiptForm.tsx` | Payment Method | 4 | → `OptionList` |
| `QuotationForm.tsx` | Status | 4 | → `OptionList` |

> **Threshold rule:** < 6 options → `OptionList` inline chips; ≥ 6 options →
> `Dropdown` modal-picker (with exceptions explicitly requested, e.g., `AddProgressLogModal` Log Type).

---

## 3. Scope

### Single Phase (this PR)
- Create `src/components/inputs/OptionList.tsx`.
- Replace `<Dropdown>` with `<OptionList>` for **Project Type** (5 items) in
  `ManualProjectEntryForm.tsx`. State (8 items) keeps `<Dropdown>`.
- Replace short-list Dropdowns in `TaskForm.tsx` (Task Type, Status, Priority).
- Replace in `ReceiptForm.tsx` (Payment Method) and `QuotationForm.tsx` (Status).
- Replace in `AddProgressLogModal.tsx` (Log Type, 7 items).
- Unit tests for `OptionList` at `__tests__/unit/OptionList.test.tsx`.
- Update existing component unit / integration tests where `Dropdown` was swapped out.

### Out of Scope
- State picker in `ManualProjectEntryForm` (8 items — stays `Dropdown`).
- Work-Type chip scroller in `TaskForm` (free-text browseable — untouched).
- Any routing, navigation, or dark-mode changes.

---

## 4. Component Design

### 4.1 `OptionList<T>` — New Reusable Component

**Location:** `src/components/inputs/OptionList.tsx`

#### Props

```typescript
export interface OptionListProps<T extends string = string> {
  label?: string;
  value: T | undefined;
  onChange: (value: T) => void;
  options: DropdownOption<T>[];
  error?: string;
  horizontal?: boolean;
  testID?: string;
}
```

#### Design Decision — OptionList is always inline

`OptionList` is a **pure inline chip renderer**. It never internally delegates
to `Dropdown`. Callers are responsible for mounting.

---