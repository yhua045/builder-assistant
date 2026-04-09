# Design: Issue #196 — Link Payment to Project in Pending Payment Screen

**Status**: DRAFT — Awaiting LGTM Approval  
**Author**: Architect Agent  
**Date**: 2026-04-09  
**GitHub Issue**: [#196](https://github.com/yhua045/builder-assistant/issues/196)  
**Branch**: `issue-196-link-payment-to-project`  
**Reviewed by**: mobile-ui agent (UI components & layout alignment)

---

## 1. Context: What #191 Already Delivered

Issue #191 shipped:
- `ProjectPickerModal` in `src/components/shared/` (with search, status badges, "Go to Project" nav)
- `PaymentDetails.tsx` project row + assignment for **real** (non-synthetic) payment records
- `noProject` filter and "Unassigned" chip on the Payments list screen

**The gap that remains for #196:**  
Synthetic "Invoice Payable" rows (`id.startsWith('invoice-payable:')`) currently show NO project row — `{!isSynthetic && (...)}` guards it away. These synthetic rows come from unpaid invoices and are the dominant items shown in the **Pending** payments view. Users cannot link them to a project without first opening a separate project screen.

---

## 2. User Stories

| # | Story |
|---|---|
| US-1 | As a Builder viewing the **Pending** payments list, I want to tap a payment card and see a **Project** field on the detail screen — even for invoice-derived rows — so I can link it to the right project on the spot. |
| US-2 | As a Builder, when I assign a project to an invoice-payable row, I want the same project to appear in the Finances screen and the Project Detail payments section without having to manually navigate and re-link. |
| US-3 | As a Builder, I cannot change the project on a **settled** or **cancelled** payment — the field is visible but read-only so I can still see the historical context. |
| US-4 | As a Builder, I can open a **Pending Payment Form** from the Payment Detail screen to edit the pending payment's metadata (date, method, notes, reference) and change the project assignment in a single unified form. |

---

## 3. Acceptance Criteria

| # | Criterion | Story |
|---|---|---|
| AC-1 | `PaymentDetails.tsx` shows a **Project** row for **both** real and synthetic invoice-payable rows. | US-1 |
| AC-2 | For a synthetic row, the project is resolved from `invoice.projectId`. If the invoice has no project, the row shows `"Unassigned"`. | US-1 |
| AC-3 | Tapping the project row on a **pending** payment (real or synthetic) opens `ProjectPickerModal`. | US-1 |
| AC-4 | After selecting a project for a **real** pending payment, `LinkPaymentToProjectUseCase` is called. The payment's `projectId` is persisted. | US-1 |
| AC-5 | After selecting a project for a **synthetic** invoice-payable row, `LinkInvoiceToProjectUseCase` is called. The invoice's `projectId` is persisted, and the synthetic row reflects the new project on reload. | US-2 |
| AC-6 | Clearing the project (via "Clear / Unassign" in the picker) sets `projectId = undefined` for the relevant record. | US-1 |
| AC-7 | After assignment, cache keys `paymentsAll`, `paidPaymentsGlobal`, `unassignedPaymentsGlobal`, `projectPayments(oldId)`, and `projectPayments(newId)` are invalidated. For the synthetic path, `invoices()` is also invalidated. | US-2 |
| AC-8 | For **settled** or **cancelled** payments, the project row is rendered as read-only text with no `ChevronRight` icon, and is not tappable. | US-3 |
| AC-9 | `LinkPaymentToProjectUseCase.execute()` throws `PaymentNotPendingError` when the target payment's status is not `'pending'`. | US-3 |
| AC-10 | `LinkInvoiceToProjectUseCase.execute()` throws `InvoiceNotEditableError` when the invoice is `'cancelled'` or `'paid'`. | US-3 |
| AC-11 | A **Pending Payment Form** modal component (`PendingPaymentForm`) is accessible from the Payment Detail header (edit icon, visible only for pending real payment records). | US-4 |
| AC-12 | `PendingPaymentForm` exposes editable fields: `date`, `dueDate`, `method`, `notes`, `reference`, and `projectId` (via embedded `ProjectPickerModal`). | US-4 |
| AC-13 | Saving the form calls `paymentRepo.update()` with all changed fields and then `LinkPaymentToProjectUseCase` if `projectId` changed. | US-4 |
| AC-14 | TypeScript strict-mode passes (`npx tsc --noEmit`) with no new errors. | — |
| AC-15 | All items in §7 Test Plan have a corresponding passing test. | — |

---

## 4. Current-State Analysis

### Relevant Files

| File | Current State | Change Required |
|---|---|---|
| `src/domain/entities/Payment.ts` | `projectId?: string` exists | None |
| `src/domain/entities/Invoice.ts` | `projectId?: string` exists | None |
| `src/domain/repositories/PaymentRepository.ts` | `update(payment)` exists | None |
| `src/domain/repositories/InvoiceRepository.ts` | `updateInvoice(id, patch)` exists | None |
| `src/application/usecases/payment/` | No `LinkPaymentToProject` UC | **New** `LinkPaymentToProjectUseCase` |
| `src/application/usecases/invoice/` | No `LinkInvoiceToProject` UC | **New** `LinkInvoiceToProjectUseCase` |
| `src/pages/payments/PaymentDetails.tsx` | Project row hidden for synthetic rows | Extend to show & edit for synthetic; add read-only guard for settled; add `PendingPaymentForm` trigger |
| `src/components/payments/` *(new)* | — | **New** `PendingPaymentForm.tsx` |
| `src/hooks/queryKeys.ts` | Has `paymentsAll`, `projectPayments`, `unassignedPaymentsGlobal` | None (already sufficient) |
| `src/components/shared/ProjectPickerModal.tsx` | Fully functional, reusable | None |

### What does NOT change

- `Payment` / `Invoice` / `Project` domain entities — no new fields.
- Database schema — `project_id` columns already exist on both `payments` and `invoices` tables.
- `PaymentTypeFilterChips` / `useGlobalPaymentsScreen` / the "Unassigned" filter (#191).
- All existing payment-recording / mark-as-paid flows.

---

## 5. Architecture Design

### Layer Responsibility Map

```
PaymentDetails (UI)
  ├─ loadData()
  │    ├─ paymentRepo.findById(paymentId)                      [existing]
  │    ├─ invoiceRepo.getInvoice(invoiceId)                    [existing]
  │    └─ projectRepo.findById(projectId ?? invoice.projectId) [extended — covers synthetic path]
  │
  ├─ handleSelectProject(project | undefined)
  │    ├─ [real pending]   → LinkPaymentToProjectUseCase       [NEW]
  │    └─ [synthetic]      → LinkInvoiceToProjectUseCase       [NEW]
  │
  └─ handleOpenPendingPaymentForm()
       └─ PendingPaymentForm modal (edits real pending payments) [NEW]

PendingPaymentForm (UI modal component)
  └─ onSave() → paymentRepo.update({ ...draft, projectId })
              → invalidations.paymentEdited({ projectId })    [using existing queryKeys pattern]
```

### New Use Cases

#### `LinkPaymentToProjectUseCase`

```
Input:  { paymentId: string; projectId: string | undefined }
Output: Payment (updated)
Guard:  payment.status === 'pending' → else throw PaymentNotPendingError
Action: paymentRepo.update({ ...payment, projectId })
```

Path: `src/application/usecases/payment/LinkPaymentToProjectUseCase.ts`

#### `LinkInvoiceToProjectUseCase`

```
Input:  { invoiceId: string; projectId: string | undefined }
Output: void
Guard:  invoice exists AND invoice.status not in ['cancelled'] AND invoice.paymentStatus !== 'paid'
        → else throw InvoiceNotEditableError
Action: projectId defined → invoiceRepo.assignProject(invoiceId, projectId)   [existing method]
        projectId undefined → invoiceRepo.updateInvoice(invoiceId, { projectId: undefined }) [clear]
```

> `InvoiceRepository.assignProject(invoiceId, projectId)` already exists on the domain interface and is implemented in `DrizzleInvoiceRepository`. We reuse it here.

Path: `src/application/usecases/invoice/LinkInvoiceToProjectUseCase.ts`

#### Domain Error Types

Add to `src/application/errors/` (or extend `TaskCompletionErrors.ts`):
```ts
export class PaymentNotPendingError extends Error { ... }
export class InvoiceNotEditableError extends Error { ... }
```

### `PendingPaymentForm` Component

**Purpose**: Edit metadata of a real pending payment record (not synthetic invoice rows).  
**Activation**: Edit (pencil) icon in `PaymentDetails.tsx` header, visible only when `payment.status === 'pending' && !isSynthetic`.  
**Presentation**: `Modal` with `presentationStyle="pageSheet"` — consistent with `ProjectPickerModal`, `AddProgressLogModal`.

**Fields**:

| Field | Control | Note |
|---|---|---|
| Date | `TextInput` ISO / date picker | Payment date |
| Due Date | `TextInput` ISO / date picker | Payment due date |
| Method | Selector (bank / cash / check / card / other) | `Pressable` chips |
| Notes | `TextInput` multiline | |
| Reference | `TextInput` | Invoice reference |
| Project | Tappable row → opens `ProjectPickerModal` | Embedded project picker |

On save: dispatches `paymentRepo.update()` then cache invalidation.  
On dismiss: no changes saved (standard cancel pattern).

---

## 6. UI Design Notes (mobile-ui agent review)

> **Note to mobile-ui agent**: Please review the component sketches below for alignment with the existing `PaymentDetails.tsx` styling (NativeWind `bg-card`, `border-border`, card sections, `ChevronRight` icons), `AddProgressLogModal.tsx` and `ProjectPickerModal.tsx` patterns.

### Project Row — Extended Behaviour

```
┌─────────────────────────────────────────────────────┐
│  DETAILS                                            │
│  Category        ............  contract             │
│  Stage           ............  Frame Stage          │
│  Due             ............  15 Apr 2026          │
│  Method          ............  —                    │
│  Reference       ............  INV-001              │
│  Project         ............  [Smith Reno ›]       │  ← tappable (pending)
│                                [Unassigned ›]       │  ← tappable, muted (no project)
│                                [Smith Reno]         │  ← read-only text (settled)
└─────────────────────────────────────────────────────┘
```

- Tappable state: primary-coloured text + `ChevronRight` (16px, muted colour)
- Read-only state: `text-foreground`, no chevron, `activeOpacity={1}` (non-interactive)
- "Unassigned" in `text-muted-foreground`

### `PaymentDetails.tsx` Header — Edit Button

```
┌──────────────────────────────────────────────────────┐
│  ← │  Smith Constructions — Frame Stage          ✏️  │
└──────────────────────────────────────────────────────┘
```

- `Pencil` icon (16px) from `lucide-react-native`, right-aligned in header
- Visible only when `payment.status === 'pending' && !isSynthetic`
- On press: opens `PendingPaymentForm` modal

### `PendingPaymentForm` Modal Layout

```
┌────────────────────────────────────────┐
│  Edit Payment                      [✕] │
├────────────────────────────────────────┤
│  Date          [15 Apr 2026        ]   │
│  Due Date      [30 Apr 2026        ]   │
│  Method        [Bank] [Cash] [Check]   │
│                [Card] [Other]          │
│  Reference     [INV-001            ]   │
│  Notes         [                   ]   │
│                [__________________]    │
│  Project       [Smith Reno       ›]    │
├────────────────────────────────────────┤
│           [     Save Changes     ]     │
└────────────────────────────────────────┘
```

- `pageSheet` modal, `KeyboardAvoidingView`
- Method selector: horizontal scrolling `Pressable` chips (pattern from `PaymentTypeFilterChips`)
- Project row: `TouchableOpacity` row → opens `ProjectPickerModal` on tap
- Save button: `bg-primary` rounded-xl (matches existing CTA style)

---

## 7. Test Plan

### Unit Tests (new files in `__tests__/unit/payment/`)

| Test file | Cases |
|---|---|
| `LinkPaymentToProjectUseCase.test.ts` | ✓ assigns project to pending payment; ✓ clears project (undefined); ✗ throws `PaymentNotPendingError` when status is `settled`; ✗ throws when payment not found |
| `LinkInvoiceToProjectUseCase.test.ts` | ✓ assigns project to unpaid invoice; ✓ clears project; ✗ throws `InvoiceNotEditableError` when invoice is `cancelled`; ✗ throws when invoice `paymentStatus === 'paid'`; ✗ throws when invoice not found |

### Integration Tests (new files in `__tests__/integration/`)

| Test file | Cases |
|---|---|
| `LinkPaymentToProject.integration.test.ts` | ✓ save pending payment → link to project → `findById` returns updated `projectId`; ✗ settled payment link attempt → rejected |
| `LinkInvoiceToProject.integration.test.ts` | ✓ save unpaid invoice → link to project → invoice has new `projectId`; ✗ cancelled invoice → rejected |

### UI Integration Tests (new files in `__tests__/integration/`)

| Test file | Cases |
|---|---|
| `PaymentDetailsSyntheticProject.integration.test.tsx` | Project row visible on synthetic invoice-payable row; tapping opens picker; selecting project calls `invoiceRepo.updateInvoice` with correct `projectId`; read-only for settled real payment |
| `PendingPaymentForm.integration.test.tsx` | Edit icon visible only for pending non-synthetic rows; opens form modal; saving persists changes via `paymentRepo.update`; project change calls `LinkPaymentToProjectUseCase` |

---

## 8. Scope Boundaries

**In scope for #196:**
- `LinkPaymentToProjectUseCase` and `LinkInvoiceToProjectUseCase`
- Extend `PaymentDetails.tsx` project row to cover synthetic invoice-payable rows
- Read-only project display for non-pending payments
- `PendingPaymentForm` modal component with fields listed in §5
- All tests listed in §7

**Out of scope:**
- Inline project assignment from the payment **list** cards (a future enhancement; list cards are navigation-only)
- Creating a new invoice or payment record from this flow
- Bulk project assignment

---

## 9. Dependency & Sequencing

```
1. New errors: PaymentNotPendingError, InvoiceNotEditableError
2. New use cases: LinkPaymentToProjectUseCase, LinkInvoiceToProjectUseCase
3. Unit tests (RED phase) — these will fail until step 4
4. Implement use cases (GREEN phase)
5. Extend PaymentDetails.tsx (synthetic project row + read-only guard + edit icon)
6. Implement PendingPaymentForm component
7. UI integration tests (RED → GREEN)
8. npx tsc --noEmit — must pass clean
```

---

## 10. Files to Create / Modify

### New files

| Path | Type |
|---|---|
| `src/application/usecases/payment/LinkPaymentToProjectUseCase.ts` | Application use case |
| `src/application/usecases/invoice/LinkInvoiceToProjectUseCase.ts` | Application use case |
| `src/application/errors/PaymentErrors.ts` | Domain error types |
| `src/components/payments/PendingPaymentForm.tsx` | UI modal component |
| `__tests__/unit/payment/LinkPaymentToProjectUseCase.test.ts` | Unit test |
| `__tests__/unit/payment/LinkInvoiceToProjectUseCase.test.ts` | Unit test |
| `__tests__/integration/LinkPaymentToProject.integration.test.ts` | Integration test |
| `__tests__/integration/LinkInvoiceToProject.integration.test.ts` | Integration test |
| `__tests__/integration/PaymentDetailsSyntheticProject.integration.test.tsx` | UI integration test |
| `__tests__/integration/PendingPaymentForm.integration.test.tsx` | UI integration test |

### Modified files

| Path | Change |
|---|---|
| `src/pages/payments/PaymentDetails.tsx` | Remove `!isSynthetic` guard; add synthetic project path; add read-only guard; add edit button → `PendingPaymentForm` |

---

## 11. Open Questions

1. **Date input UX**: Should `date` / `dueDate` fields in `PendingPaymentForm` use a native date picker (platform-dependent) or plain text input (ISO)? → **A** use native date picker for better UX.
2. **Invoice project propagation**: When a user links the invoice to a project, should existing real `Payment` records on that invoice also get their `projectId` updated? → **A** Only the invoice's `projectId` is updated. The only scenario where a real payment would have a different `projectId` is if it was created as standalone payment (such as adhoc expense) and then later linked to a project.
3. **Synthetic row "edit" scope**: The `PendingPaymentForm` is designed for **real** pending payment records only. Should it also support editing the parent invoice's metadata (contractor name, total, etc.) for synthetic rows? **A** In fact, the 'pending payment' is the Invoice record which is not linked to any payment record yet. (Thus they are pending payment because they are not paid yet). So the `PendingPaymentForm` will edit the Invoice record directly when opened from a synthetic row. We do not need to edit the 'real' payment record because it does not exist yet.
