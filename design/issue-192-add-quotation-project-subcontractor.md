# Design: Issue #192 — Add Quotation: Project Field + Subcontractor Picker + Layout Fix

**Status**: DRAFT — Awaiting LGTB Approval  
**Author**: Architect Agent  
**Date**: 2026-04-09  
**GitHub Issue**: #192  
**Branch**: `issue-192-add-quotation-project-subcontractor`

---

## 1. User Story

As a builder, when I open "Add Quote" from the Dashboard, I want to:
1. Select an existing **Project** to associate the quotation with.
2. Pick the **Client/Vendor** using the same contact picker UX I already use in Task Detail (subcontractor picker – search existing or quick-add inline).
3. See both fields populated when I view the quotation in **Quotation Detail**.
4. Have the modal visually consistent with other Dashboard modal screens (InvoiceScreen spacing and header).

---

## 2. Acceptance Criteria

| # | Criterion |
|---|---|
| AC-1 | `QuotationForm` shows a **Project** field (picker) that lists existing projects; selecting one stores `projectId` on submit. |
| AC-2 | `QuotationForm` replaces the plain text "Client / Vendor" input with a **subcontractor picker row** (same UX as `TaskSubcontractorSection` / `SubcontractorPickerModal`). Selecting a contact sets `vendorId` and auto-fills `vendorName` / `vendorEmail`. |
| AC-3 | **Quick-add inline**: if the desired vendor is not in the contact list, the user can quick-add a new contact (via `QuickAddContractorModal`) and the new contact is automatically selected. |
| AC-4 | `onSubmit` from `QuotationForm` includes `projectId` and `vendorId` in its payload. Both are persisted (columns already exist in `quotations` table; no migration needed). |
| AC-5 | `QuotationDetail` screen displays a **Project** row (project name, or nothing if unset) and the **Client/Vendor** name below the reference. |
| AC-6 | `QuotationScreen` modal has a proper header (`"New Quotation"` title + close `✕` button) and uses `SafeAreaView` with `pt-8` top padding, matching `InvoiceScreen`. |
| AC-7 | `QuotationForm` internal spacing uses consistent NativeWind tokens: `mb-4` between fields, `px-6` horizontal padding (when `embedded=false`), `gap-4` button row. |
| AC-8 | Unit tests: `QuotationForm` renders Project picker & vendor picker row; submitting after selection delivers `projectId` and `vendorId` to `onSubmit`. |
| AC-9 | Unit test: `QuotationForm` vendor quick-add creates a contact and selects it. |
| AC-10 | Integration test: `QuotationScreen` end-to-end – select project + vendor, save; resulting `Quotation` object has `projectId` and `vendorId`. |
| AC-11 | Snapshot tests: `QuotationForm` layout with and without `embedded` prop. |
| AC-12 | TypeScript strict mode passes (`npx tsc --noEmit`). |
| AC-13 | Existing `QuotationForm` tests pass without regression. |

---

## 3. Current State Analysis

| Concern | Current State | Gap |
|---------|---------------|-----|
| `Quotation` entity | Has `projectId?: string` and `vendorId?: string` fields | **No gap** — fields exist |
| `quotations` DB table | Has `project_id` and `vendor_id` columns, indexed | **No gap** — no migration needed |
| `DrizzleQuotationRepository` | Maps `projectId` and `vendorId` in `mapToEntity`, persists in `create`/`update` | **No gap** |
| `CreateQuotationUseCase` | Passes full `Quotation` to `repo.createQuotation()` | **No gap** |
| `QuotationForm` | Plain text input for `vendorName`; no project field; mixed/inconsistent `p-0`/`p-4` padding | **Replace vendor input; add project picker; fix spacing** |
| `QuotationScreen` | `Modal` with no header title/close button; `px-4 pt-4` container; no `SafeAreaView` | **Add header; wrap with `SafeAreaView`; align to `InvoiceScreen` pattern** |
| `QuotationDetail` | Shows `vendorName` inline; no project row | **Add Project row; improve vendor row display** |
| `SubcontractorPickerModal` | Exists in `src/components/tasks/`; used in `TaskDetailsPage` | Needs to be consumed in `QuotationForm` |
| `ProjectPickerModal` | Newly added in #191 inside `src/components/payments/` | Move to `shared/` or `inputs/`, make `onNavigate` optional, and drop into `QuotationForm` |

---

## 4. Architecture Design

### 4.1 Dependency Flow

```
QuotationScreen (Modal)
  └── QuotationForm
        ├── ProjectPickerModal (shared)
        │     └── ProjectRepository (domain)
        ├── SubcontractorPickerModal (components/tasks/SubcontractorPickerModal)
        │     └── useContacts (hook)
        │           └── ContactRepository (domain)
        │     └── QuickAddContractorModal (inline new-contact flow)
        └── onSubmit → useQuotations.createQuotation → CreateQuotationUseCase
```

### 4.2 No New Abstractions Required

- `Quotation` entity: unchanged (fields already there).
- `QuotationRepository` / `DrizzleQuotationRepository`: unchanged.
- `CreateQuotationUseCase` / `UpdateQuotationUseCase`: unchanged.
- `useQuotations` hook: unchanged — `createQuotation` already accepts a full `Quotation`-shaped payload.

---

## 5. Component Changes

### 5.1 `QuotationForm.tsx` (main change)

**New props** (extend `QuotationFormProps`):
```typescript
/** Pre-selected projectId (e.g. when opened from ProjectDetail) */
projectId?: string;
/** Pre-selected vendorId (e.g. from OCR-parsed contact) */
vendorId?: string;
```

**New state**:
```typescript
const [selectedProjectId, setSelectedProjectId] = useState(
  initialValues?.projectId ?? props.projectId ?? ''
);
const [selectedVendor, setSelectedVendor] = useState<SubcontractorContact | undefined>(
  initialValues?.vendorId
    ? { id: initialValues.vendorId, name: initialValues.vendorName ?? '' }
    : undefined
);
const [vendorPickerVisible, setVendorPickerVisible] = useState(false);
```

**Field order** (revised):
```
1. Reference (optional, auto-generate hint)
2. Project         ← NEW: <ProjectPickerModal> via tappable row or button
3. Client / Vendor ← REPLACED: <SubcontractorPickerRow> opens SubcontractorPickerModal
4. Vendor Email    (auto-filled from picked contact; still editable)
5. Issue Date
6. Expiry Date
7. Total (required)
8. Line Items
9. Notes
```

**`handleSubmit` additions**:
```typescript
projectId: selectedProjectId || undefined,
vendorId: selectedVendor?.id || undefined,
vendorName: selectedVendor?.name || vendorName || undefined,
vendorEmail: selectedVendor?.email || vendorEmail || undefined,
```

**Vendor picker row** (replaces the plain `TextInput`):
```
┌─────────────────────────────────────────┐
│  👷 Jane Smith (Electrician)       [✎]  │   ← selected state
│  or                                     │
│  + Add Client / Vendor                  │   ← empty state, tappable
└─────────────────────────────────────────┘
```

**Layout fix (spacing tokens)**:
- Form `ScrollView`: `className="flex-1 bg-background"` (no raw padding; individual fields handle spacing).
- Each field group: `className="px-6 mb-4"` (not mixed `p-0`/`p-4`).
- Button row: `className="px-6 gap-4 flex-row mt-6 mb-8"`.
- When `embedded=true`: keep existing `p-0` override to let parent control outer padding.

### 5.2 `QuotationScreen.tsx` (header + layout)

Add a proper modal header (matching `InvoiceScreen` form view `px-4 pt-8 pb-2`):
```tsx
<SafeAreaView className="flex-1 bg-background">
  {/* Modal Header */}
  <View className="px-6 pt-8 pb-4 flex-row items-center justify-between border-b border-border">
    <Text className="text-2xl font-bold text-foreground">New Quotation</Text>
    <Pressable onPress={onClose} testID="quotation-modal-close-button">
      <X size={24} className="text-foreground" />
    </Pressable>
  </View>

  {/* Upload Pressable */}
  <View className="px-6 pt-4 pb-2">…</View>

  {/* QuotationForm */}
  <QuotationForm … embedded />
</SafeAreaView>
```

### 5.3 `QuotationDetail.tsx` (display new fields)

Add a **Project** row between the reference and the total in the summary card:

```tsx
{quotation.projectId && (
  <View className="flex-row items-center gap-2 mb-3">
    <FolderOpen size={14} className="text-muted-foreground" />
    <Text className="text-sm text-muted-foreground" testID="quotation-detail-project-name">
      {projectName ?? quotation.projectId}
    </Text>
  </View>
)}
```

Load `projectName` in `QuotationDetailScreen`:
```typescript
if (quotation.projectId) {
  const projectRepo = container.resolve<ProjectRepository>('ProjectRepository');
  const project = await projectRepo.getProject(quotation.projectId);
  setProjectName(project?.name ?? null);
}
```

Improve vendor display: show `vendorName` prominently if set; link via `vendorId` opens contact detail (out of scope for this ticket — leave as text-only for now).

---

## 6. UI Mockups

### 6.1 Add Quotation Modal (QuotationScreen)

```
┌──────────────────────────────────────────┐
│  New Quotation                     [✕]   │  ← SafeAreaView header, pt-8
├──────────────────────────────────────────┤
│  ┌────────────────────────────────────┐  │
│  │  📎  Upload Quote PDF              │  │  ← upload Pressable (existing)
│  └────────────────────────────────────┘  │
├──────────────────────────────────────────┤  ← ScrollView (embedded form)
│  Reference (optional)                    │  px-6 mb-4
│  ┌────────────────────────────────────┐  │
│  │ Auto-generate                      │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Project                                 │  px-6 mb-4  ← NEW
│  ┌────────────────────────────────────┐  │
│  │ None ▾                             │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Client / Vendor                         │  px-6 mb-4  ← REPLACED
│  ┌────────────────────────────────────┐  │
│  │  👷  + Add Client / Vendor         │  │  ← tappable row
│  └────────────────────────────────────┘  │
│  (after selection):                      │
│  ┌────────────────────────────────────┐  │
│  │  👷  Jane Smith (Electrician) [✎]  │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Vendor Email (auto-filled if contact)   │
│  Issue Date        │  Expiry Date        │
│  Total (AUD)                             │
│  + Add Line Item                         │
│  Notes                                   │
│                                          │
│  [   Cancel   ]  [  Save Quotation  ]    │  px-6 gap-4 mt-6
└──────────────────────────────────────────┘
```

### 6.2 Subcontractor Picker (re-used modal, no changes)

```
┌──────────────────────────────────────────┐
│  [🔍 Search contractors…]                │
├──────────────────────────────────────────┤
│  👷 Jane Smith (Electrician)             │ ← existing contact rows
│  👷 Bob Plumber (Plumber)               │
│  …                                       │
├──────────────────────────────────────────┤
│  [+ Quick Add Contractor]               │ ← opens QuickAddContractorModal
└──────────────────────────────────────────┘
```

### 6.3 Quotation Detail (updated summary card)

```
┌────────────────────────────────────────────┐
│  [📄]                              [Draft] │
│  QUO-20260409-ABC123                       │
│  📁 Bathroom Renovation                    │  ← NEW project row
│  👤 Jane Smith · jane@example.com          │  ← improved vendor display
│                                            │
│  AUD 4,500.00                              │
│  ┌──────────────┐  ┌──────────────┐        │
│  │ Issued       │  │ Expires      │        │
│  │ 9 Apr 2026   │  │ 9 May 2026   │        │
│  └──────────────┘  └──────────────┘        │
└────────────────────────────────────────────┘
```

---

## 7. Test Plan

### 7.1 Unit Tests (`__tests__/unit/`)

#### `QuotationForm.test.tsx` — additions

| Test | Description |
|------|-------------|
| `renders project picker row` | `testID="quotation-project-picker-row"` present, opens `ProjectPickerModal` on tap |
| `renders vendor picker row (empty)` | Row with `testID="quotation-vendor-picker-row"` shows "+ Add Client / Vendor" label |
| `opens SubcontractorPickerModal on vendor row press` | Modal visible after press |
| `selecting vendor sets vendorId and vendorName` | `onSubmit` called with `vendorId` and `vendorName` |
| `vendor quick-add creates contact and selects it` | `QuickAddContractorModal` flow ends with new contact selected; `onSubmit` has `vendorId` |
| `selecting project sets projectId` | `onSubmit` called with `projectId` |
| `submit with no project and no vendor is valid (both optional)` | Form saves without project/vendor |
| `snapshot: form default state` | Full form layout snapshot |
| `snapshot: form with project and vendor selected` | Layout snapshot showing selected values |

#### `QuotationScreen.test.tsx` — additions / updates

| Test | Description |
|------|-------------|
| `renders modal header with title and close button` | `testID="quotation-modal-close-button"` present |
| `close button calls onClose` | `onClose` prop called |
| `snapshot: QuotationScreen modal layout` | Full modal snapshot |

### 7.2 Unit Tests — `QuotationDetail.test.tsx`

| Test | Description |
|------|-------------|
| `shows project name row when projectId set` | `testID="quotation-detail-project-name"` shows project name |
| `hides project row when projectId absent` | Row not rendered |
| `shows vendorName in summary card` | Existing test updated to use new markup |

### 7.3 Integration Tests (`__tests__/integration/`)

#### `QuotationScreen.integration.test.tsx` — additions

| Test | Description |
|------|-------------|
| `saves quotation with projectId and vendorId` | Open screen, select project and vendor, save; `createQuotation` mock receives correct fields |

---

## 8. Migration Notes

**No DB migration required.** The `quotations` table already has:
- `project_id TEXT` with index `idx_quotations_project`
- `vendor_id TEXT` with index `idx_quotations_vendor`

`DrizzleQuotationRepository` already maps and persists both columns. Running `npm run db:generate` is not needed.

---

## 9. Out of Scope

- Editing an existing quotation's project/vendor (update flow — future ticket).
- Tapping a vendor name in `QuotationDetail` to navigate to contact detail.
- Pre-populating `projectId` when "Add Quote" is opened from `ProjectDetail` (can be a follow-up enhancement once `QuotationForm` accepts `projectId` prop).
- Any OCR-based vendor matching improvements.

---

## 10. File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/components/shared/ProjectPickerModal.tsx` | **Refactor** | Move from `src/components/payments/`, update to make `onNavigate?: () => void` optional so `QuotationForm` can use it easily without forcing navigation. Update existing payment imports to match new path. |
| `src/components/quotations/QuotationForm.tsx` | **Modify** | Use the shared `ProjectPickerModal`, replace vendor text input with picker row + `SubcontractorPickerModal`, fix spacing tokens, emit `projectId`/`vendorId` |
| `src/pages/quotations/QuotationScreen.tsx` | **Modify** | Add modal header with title + close button, wrap with `SafeAreaView`, align padding to `InvoiceScreen` |
| `src/pages/projects/QuotationDetail.tsx` | **Modify** | Add Project row, load project name from DI container, improve vendor display |
| `__tests__/unit/QuotationForm.test.tsx` | **Modify** | Add picker tests, snapshot tests |
| `__tests__/unit/QuotationScreen.test.tsx` | **Modify/Create** | Header/close-button tests, snapshot |
| `__tests__/unit/QuotationDetail.test.tsx` | **Create** | Project row and vendor row rendering |
| `__tests__/integration/QuotationScreen.integration.test.tsx` | **Modify** | Add end-to-end save test with projectId + vendorId |

**No new files** are required in `domain/`, `application/`, or `infrastructure/`.

---

## 11. Mobile-UI Review Notes

> **Pending review from `mobile-ui` agent** — the following decisions should be validated:
>
> - **Vendor picker row** height: 56dp (matching `SubcontractorPickerModal` row height), with `bg-card border border-border rounded-2xl` to match the TaskSubcontractorSection card style.
> - **Project picker row** should map to the newly introduced `ProjectPickerModal` (from #191). The row UI should match the vendor picker row (card style) and open the modal slide-up.
> - **Spacing**: `px-6 mb-4` per field group when non-embedded. When `embedded=true`, use `px-0 mb-4` and let `QuotationScreen` handle outer padding.
> - **Visual rhythm on small screens**: vendor row + project picker stacked without crowding. Ensure total form height scrolls comfortably on a 375pt screen without requiring pinch-zoom.
> - **Snapshot baseline**: Confirm snapshot rendering at `width=375` (iPhone SE) and `width=428` (iPhone Pro Max).
