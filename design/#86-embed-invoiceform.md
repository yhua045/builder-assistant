# Issue #86 — Embed `InvoiceForm` Directly into `InvoiceScreen`

Last Updated: 2026-02-18
Branch: `issue-86-embed-invoiceform`

---

## 1. User Story

As a user, I want to create or edit invoices inline within `InvoiceScreen` — without an extra navigation hop to a separate form screen — mirroring the UX of `SnapReceiptScreen` which embeds `ReceiptForm` directly.

---

## 2. Current State (As-Is)

### `InvoiceScreen` (`src/pages/invoices/InvoiceScreen.tsx`)
- A **gateway screen** that offers two paths: Upload PDF or Manual Entry.
- On "Upload PDF": runs OCR → normalisation pipeline → navigates to extraction review.
- On "Manual Entry" (`handleManualEntry`): calls `onNavigateToForm({ mode: 'create' })` — **navigating away** to a separate form screen.
- On "Accept Extraction": calls `onNavigateToForm({ mode: 'create', initialValues, pdfFile })` — also **navigating away**.
- `onNavigateToForm` is injected as a prop; the caller (not yet surfaced in `src/`) owns the navigation.

### `InvoiceForm` (`src/components/invoices/InvoiceForm.tsx`)
- A full-featured form component with `mode: 'create' | 'edit'`, `onCreate`, `onUpdate`, `onCancel` callback props.
- Uses `StyleSheet` (not NativeWind) for styling.
- Has no knowledge of hooks or use-cases; pure UI + call callbacks.

### `SnapReceiptScreen` (reference pattern, `src/pages/receipts/SnapReceiptScreen.tsx`)
- Imports and renders `ReceiptForm` **inline** within the screen component.
- Calls `useSnapReceipt` hook for save/processing; passes `handleSave` directly to `ReceiptForm.onSubmit`.
- Toggle between camera-capture UI and manual form via local state (`normalizedData`).

### `useInvoices` (`src/hooks/useInvoices.ts`)
- Provides `createInvoice`, `updateInvoice`, `deleteInvoice`, `getInvoiceById`, `refreshInvoices`.
- Wired to `CreateInvoiceUseCase`, `UpdateInvoiceUseCase`, etc. via DI container.
- Already sufficient to support inline save from `InvoiceScreen`.

---

## 3. Problem

The current `InvoiceScreen` delegates form rendering to a separate screen via a navigation callback (`onNavigateToForm`). This causes an extra navigation hop and breaks parity with the `SnapReceiptScreen` pattern. The `InvoiceForm` component exists and is well-structured; there is no technical blocker to embedding it inline.

---

## 4. Proposed Solution

### Core Approach: Inline State Machine in `InvoiceScreen`

Extend `InvoiceScreen` with a local `view` state that controls which UI is rendered within the same screen component — matching the `SnapReceiptScreen` pattern exactly.

```
view = 'upload'          → current upload/OCR gateway UI (default)
view = 'form'            → InvoiceForm rendered inline
view = 'review'          → existing ExtractionResultsPanel (already exists)
view = 'error'           → existing error UI (already exists)
```

On save (from inline form), call `useInvoices.createInvoice()` / `updateInvoice()` directly, then call `onClose()` on success — no navigation needed.

### What Changes

#### `src/pages/invoices/InvoiceScreen.tsx`
- Import `InvoiceForm` and `useInvoices`.
- Replace `onNavigateToForm` prop with no new navigation prop (prop can be kept as optional for backward compat with tests, but all internal calls switch to local state transitions).
- Add `view` state: `'upload' | 'form' | 'review' | 'error'`.
- Add `formInitialValues` and `formPdfFile` state to pass context into the embedded form.
- Wire `handleManualEntry` to set `view = 'form'` instead of calling `onNavigateToForm`.
- Wire `handleAcceptExtraction` to set `view = 'form'` with `formInitialValues` and `formPdfFile`.
- Add `handleFormSave` handler that calls `useInvoices.createInvoice()` and calls `onClose()` on success.
- Add a "back" control within the form view (e.g., "← Back" pressable) to return to `view = 'upload'`.
- Add `embedded?: boolean` prop to `InvoiceForm` call site (for layout padding only, per issue note).

#### `src/components/invoices/InvoiceForm.tsx`
- Add optional `embedded?: boolean` prop (no behaviour change; adjusts outer padding only).
- Migrate styles from `StyleSheet` to NativeWind (`className`) for consistency — **separate, optional cleanup step** (can be deferred to a follow-up issue to minimise diff size).
- No changes to callback API (`onCreate`, `onUpdate`, `onCancel`).

#### `src/hooks/useInvoices.ts`
- No changes expected; existing `createInvoice` / `updateInvoice` API is sufficient.

#### Prop deprecation: `onNavigateToForm`
- Keep the prop but mark it `@deprecated` in JSDoc. Remove call sites from `InvoiceScreen`'s internal logic. Existing tests that pass a mock for this prop will continue to compile; update the tests to assert inline rendering instead.

### What Does NOT Change
- `ExtractionResultsPanel` and the OCR pipeline remain unchanged.
- `useInvoices` DI wiring remains unchanged.
- No schema or migration changes.
- `InvoiceDetailPage` and `InvoiceListPage` remain unchanged.

### Component Layout Sketch

```
InvoiceScreen (view='upload')          InvoiceScreen (view='form')
┌─────────────────────────┐            ┌─────────────────────────┐
│ Add Invoice             │            │ ← Back   New Invoice    │
│                         │            │─────────────────────────│
│ [Upload Invoice PDF]    │  ──────►   │ InvoiceForm (embedded)  │
│         ─ Or ─          │            │   Invoice Number        │
│ [Enter Invoice Details] │            │   Vendor / Issuer       │
│                         │            │   Total *  Currency *   │
│ [Cancel]                │            │   ...                   │
└─────────────────────────┘            │ [Cancel]  [Create]      │
                                       └─────────────────────────┘
```

---

## 5. Acceptance Criteria

1. `InvoiceScreen` renders `InvoiceForm` inline when the user taps "Enter Invoice Details" — no separate screen navigation occurs.
2. `InvoiceScreen` renders `InvoiceForm` inline (pre-filled) when the user accepts an OCR extraction result.
3. On successful save, `onClose()` is called and the invoice list refreshes (via `useInvoices`).
4. The "back" control within the form view returns to the `'upload'` view without data loss to the rest of the screen state.
5. Existing OCR pipeline, extraction review panel, and error states are unaffected.
6. `InvoiceForm` remains usable standalone (existing callers not broken).
7. Unit tests in `__tests__/unit/InvoiceScreen.test.tsx` updated to assert inline form rendering.
8. Unit tests in `__tests__/unit/InvoiceForm.test.tsx` updated to cover `embedded` prop variant.
9. Integration test `__tests__/integration/InvoiceScreen.integration.test.tsx` updated to cover end-to-end create flow.
10. `npx tsc --noEmit` passes with no new errors.

---

## 6. Files To Change

| File | Change |
|---|---|
| `src/pages/invoices/InvoiceScreen.tsx` | Add `view` state machine, embed `InvoiceForm`, wire `useInvoices` |
| `src/components/invoices/InvoiceForm.tsx` | Add optional `embedded?: boolean` prop |
| `src/hooks/useInvoices.ts` | No change expected (verify) |
| `__tests__/unit/InvoiceScreen.test.tsx` | Update to assert inline form, remove `onNavigateToForm` assertions for manual entry |
| `__tests__/unit/InvoiceForm.test.tsx` | Add tests for `embedded` prop |
| `__tests__/integration/InvoiceScreen.integration.test.tsx` | Update/add end-to-end create via embedded form |

---

## 7. TDD Workflow (per CLAUDE.md)

1. **Red**: Update `InvoiceScreen.test.tsx` to assert that tapping "Enter Invoice Details" renders `testID="invoice-form"` inline (currently fails because current code calls `onNavigateToForm`).
2. **Red**: Add integration test asserting inline create flow saves to DB and calls `onClose`.
3. **Green**: Implement `view` state machine and inline `InvoiceForm` in `InvoiceScreen`.
4. **Refactor**: Clean up `onNavigateToForm` deprecation, verify no regressions.
5. **PR**: Reference this design doc, link failing tests, request review.

---

## 8. Migration Notes

No schema changes. No Drizzle migrations needed.

---

## 9. Open Questions (Requiring Stakeholder Input)

1. **`onNavigateToForm` removal**: Should the prop be removed immediately (breaking change for any external callers) or kept `@deprecated` and removed in a follow-up? Proposed: keep `@deprecated`, remove in follow-up.
2. **NativeWind migration of `InvoiceForm`**: Should `StyleSheet` → NativeWind be done in this PR or deferred? Proposed: defer to keep diff focused.
3. **Edit flow**: Issue #86 mentions both create *and* edit. Should the `view='form'` path also support edit (e.g., from `InvoiceDetailPage` via a prop)? Proposed: include edit in this PR via an optional `initialInvoice` prop on `InvoiceScreen`.

---

## 10. PR Checklist

- [ ] Design doc reviewed and approved
- [ ] Unit tests written (failing) before implementation
- [ ] Implementation makes unit tests pass
- [ ] Integration tests added and passing
- [ ] `npx tsc --noEmit` passes
- [ ] PR description references this doc and original failing tests
- [ ] Summarise changes in `progress.md` after merge
