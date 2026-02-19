# Issue #90 — Replace Dashboard "Add Invoice" action to open `InvoiceScreen` modal

## Overview

**This is a UI wiring change only — no new domain entities, use cases, repositories, schema migrations, or form components are needed.**

The project already has:
- `InvoiceScreen` (`src/pages/invoices/InvoiceScreen.tsx`) — a full modal-ready screen that embeds `InvoiceForm` with upload/OCR pipeline and inline form flow
- `InvoiceForm` (`src/components/invoices/InvoiceForm.tsx`) — the canonical invoice creation form
- `useInvoices` hook — repository-backed invoice CRUD
- All Drizzle schema/migrations for invoices in place
- Existing tests: `DashboardInvoiceIntegration.test.tsx`, `InvoiceScreen.test.tsx`, `InvoiceForm.test.tsx`

**Current behaviour (Dashboard `src/pages/dashboard/index.tsx`):**
```
"Add Invoice" button (actionId '2')
  → setShowAddInvoice(true)
  → Renders a <Modal> that wraps <InvoiceForm> directly
      (bypasses InvoiceScreen entirely)
```

**Target behaviour:**
```
"Add Invoice" button (actionId '2')
  → setShowAddInvoice(true)
  → Renders a <Modal> that wraps <InvoiceScreen>
      (single source of truth; full upload + manual-entry flow)
```

---

## User Story

As a contractor, when I tap "Add Invoice" from the Dashboard Quick Actions, I get the full `InvoiceScreen` experience (upload PDF, OCR pipeline, manual entry) — not just a bare form.

---

## Acceptance Criteria (from issue #90)

1. Clicking the Dashboard "Add Invoice" (FAB) button opens the `InvoiceScreen` modal.
2. `InvoiceScreen` displays the same `InvoiceForm` used elsewhere (no duplicated logic).
3. Closing the modal returns the user to the Dashboard with the same UI state as before.
4. Existing flows that already navigate to `InvoiceScreen` continue to work unchanged.
5. Unit/integration tests updated to verify the modal opens and that `InvoiceScreen` (not bare `InvoiceForm`) is present inside the modal.
6. `npx tsc --noEmit` passes; app runs on simulator.

---

## What Changes

### `src/pages/dashboard/index.tsx`

| Before | After |
|---|---|
| Imports `InvoiceForm` | Import `InvoiceScreen` instead |
| Modal renders `<SafeAreaView><InvoiceForm ...></SafeAreaView>` | Modal renders `<InvoiceScreen onClose={...} />` |
| Needs `handleCreateInvoice` callback wired to `InvoiceForm.onCreate` | `InvoiceScreen` manages its own save via `useInvoices` internally; `onClose` is sufficient |
| `useInvoices` used directly in Dashboard for invoice creation | Remove `const { createInvoice } = useInvoices()` from Dashboard (handled inside `InvoiceScreen`) |

Diff sketch:
```tsx
// REMOVE:
import { InvoiceForm } from '../../components/invoices/InvoiceForm';
const { createInvoice } = useInvoices();
const handleCreateInvoice = async (invoice: any) => { ... };

// ADD:
import { InvoiceScreen } from '../invoices/InvoiceScreen';

// CHANGE modal body (the "Add Invoice" Modal):
// Before:
<SafeAreaView className="flex-1 bg-background">
  <InvoiceForm
    mode="create"
    onCreate={handleCreateInvoice}
    onCancel={() => setShowAddInvoice(false)}
    isLoading={false}
  />
</SafeAreaView>

// After:
<InvoiceScreen onClose={() => setShowAddInvoice(false)} />
```

> Note: `InvoiceScreen` already calls `useInvoices` internally and calls `onClose()` after a successful save. No wiring changes needed inside `InvoiceScreen`.

---

### `__tests__/integration/DashboardInvoiceIntegration.test.tsx`

- **Remove** the mock of `InvoiceForm` that currently stubs out the modal content.
- **Add** a mock of `InvoiceScreen` (similar to how `SnapReceiptScreen` is mocked).
- **Update** the test assertion: after tapping "Add Invoice", assert `InvoiceScreen` is rendered inside the modal, not `InvoiceForm`.
- Keep existing tests for modal open/close, Quick Actions visibility, etc.

---

## What Does NOT Change

- `InvoiceScreen.tsx` — no changes needed; it already accepts `onClose` and self-manages form saving.
- `InvoiceForm.tsx` — unchanged.
- `useInvoices.ts` — unchanged.
- Domain, use cases, repositories, schema, migrations — **no changes**.
- All other dashboard actions and modals — unchanged.

---

## Tests (TDD order)

1. **Update failing test** in `DashboardInvoiceIntegration.test.tsx`:
   - Mock `InvoiceScreen` instead of `InvoiceForm` in the Dashboard test.
   - Assert after tapping "Add Invoice" → `InvoiceScreen` is mounted (not bare `InvoiceForm`).
   - Assert modal closes when `onClose` is triggered.
2. **Run** `npm test -- DashboardInvoiceIntegration` — currently **passes** (tests the old `InvoiceForm` path); after step 1 update it should **fail** until the Dashboard is changed.
3. **Implement** the Dashboard change.
4. **Re-run** tests — all pass.
5. **Run** `npx tsc --noEmit` — no issues expected (types align; `InvoiceScreen` already exports matching props).

---

## Files to Touch

| File | Change |
|---|---|
| [src/pages/dashboard/index.tsx](src/pages/dashboard/index.tsx) | Swap `InvoiceForm` → `InvoiceScreen` in the "Add Invoice" modal |
| [__tests__/integration/DashboardInvoiceIntegration.test.tsx](__tests__/integration/DashboardInvoiceIntegration.test.tsx) | Update mock + assertion for `InvoiceScreen` |

Two files total. No new files created.

---

## Acceptance Test Checklist

- [ ] Dashboard "Add Invoice" modal renders `InvoiceScreen` (not bare `InvoiceForm`)
- [ ] Modal closes after successful invoice save (via `InvoiceScreen.onClose`)
- [ ] Modal closes on cancel without side effects
- [ ] Existing `InvoiceScreen` tests still pass (`InvoiceScreen.test.tsx`)
- [ ] `DashboardInvoiceIntegration` tests pass with updated assertions
- [ ] `npx tsc --noEmit` passes

---

## Open Questions (for approval)

1. **Modal presentation style**: should the `InvoiceScreen` modal use `presentationStyle="pageSheet"` (current `SnapReceiptScreen` style, slides up from bottom as a sheet) or `fullScreen`? The current `InvoiceForm` modal uses `pageSheet` — recommend keeping `pageSheet` for consistency.
2. **`useInvoices` in Dashboard**: `handleCreateInvoice` and its `useInvoices` dependency can be removed from the Dashboard once `InvoiceScreen` handles saving internally. Confirm we should clean this up (keeping it would be dead code).

---

*Design doc created: 2026-02-19. Awaiting approval before implementation.*
