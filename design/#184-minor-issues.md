# Design: #184 Minor Issues — Receipt & Invoice Form Polish

**Issue**: #184  
**Date**: 2026-03-27  
**Status**: Draft — awaiting TDD handoff

---

## 1. User Story

> As a builder, when I snap a receipt or enter an invoice manually, I want  
> the vendor field to look up real contractors, the currency to default to  
> AUD, invoice numbers to be auto-generated when I leave the field blank,  
> and the invoice form to be simpler (no currency/subtotal/tax fields shown).

---

## 2. Scope

### Included
- Domain: tighten validation rules (vendorId required, amount > 0, ISO date, AUD as default currency).
- Domain / Application: `InvoiceEntity.create` auto-generates `externalReference` (invoiceNumber) when the field is blank.
- Infrastructure: `DrizzleReceiptRepository.createReceipt` writes an invoice **and** a `settled` payment atomically for receipts; writes an `unpaid` invoice (no payment row) for the new `createUnpaidInvoice` path.
- Infrastructure: after writes, update `pendingPayments` / `totalPayments` aggregates on the linked project row (via a follow-up UPDATE within the same transaction).
- UI — Snap a Receipt screen: replace the plain `TextInput` for Vendor with a **Contractor Lookup** field (reuses `SubcontractorPickerModal` / `QuickAddContractorModal` pattern).
- UI — Snap an Invoice screen: replace plain Vendor `TextInput` with Contractor Lookup; hide currency, subtotal, and tax fields; default invoice date to today; move the "Upload Invoice PDF" button to the top of the screen; show the form body by default (not collapsed).

### Excluded
- Editing existing invoices/receipts.
- Line-item support.
- Currency selection UI (AUD is always fixed in this iteration).
- Payment lifecycle beyond `settled`/`unpaid` statuses.

---

## 3. Acceptance Criteria

### Domain / Application
- [ ] `SnapReceiptDTO.vendorId: string` is required; `SnapReceiptUseCase` throws `'Vendor is required'` when blank / missing.
- [ ] `SnapReceiptUseCase` throws `'Amount must be positive'` when `amount <= 0`.
- [ ] `SnapReceiptUseCase` stores `currency: 'AUD'` (not `'USD'`).
- [ ] `SnapReceiptDTO.date` must be a valid ISO-8601 string; use case throws `'Date must be a valid ISO date'` when invalid.
- [ ] `InvoiceEntity.create` auto-generates `externalReference` in the format `INV-YYYYMMDD-XXXX` (6-char random suffix) when the field is blank or absent.
- [ ] `InvoiceEntity.create` defaults `currency` to `'AUD'` (not `'USD'`).
- [ ] A new `createUnpaidInvoice(invoice: Invoice): Promise<Invoice>` method is added to `ReceiptRepository` (alongside the existing `createReceipt`).

### Infrastructure
- [ ] `DrizzleReceiptRepository.createReceipt` inserts invoice (status `'paid'`, paymentStatus `'paid'`) and payment (status `'settled'`) inside a single SQL transaction.
- [ ] After a successful `createReceipt`, the repository runs `UPDATE projects SET total_payments = total_payments + ?, updated_at = ? WHERE id = ?` within the same transaction (when `invoice.projectId` is set).
- [ ] `DrizzleReceiptRepository.createUnpaidInvoice` inserts an invoice row (status `'issued'`, paymentStatus `'unpaid'`) and runs `UPDATE projects SET pending_payments = pending_payments + ?, updated_at = ? WHERE id = ?` within the same transaction (when `invoice.projectId` is set).
- [ ] Both paths roll back the full transaction on any error.

### UI — Snap a Receipt screen (`ReceiptForm`)
- [ ] The Vendor field uses `ContractorLookupField` (a new thin wrapper around `SubcontractorPickerModal`) instead of a plain `TextInput`.
- [ ] Selecting a contractor sets both `vendorId` (Contact.id) and `vendor` (Contact.name) in form state.
- [ ] `SnapReceiptDTO` submitted from the form includes `vendorId`.
- [ ] Currency is not shown; `'AUD'` is submitted silently.

### UI — Snap an Invoice screen (`InvoiceForm` / invoice upload screen)
- [ ] The Vendor field uses `ContractorLookupField`.
- [ ] Currency, Subtotal, and Tax fields are hidden.
- [ ] Invoice Date defaults to today when no `initialValues.dateIssued` is provided.
- [ ] "Upload Invoice PDF" button/section appears at the **top** of the screen (above the form).
- [ ] The form body is visible by default (not behind a toggle/collapsed state).
- [ ] `invoiceNumber` / `externalReference` field accepts input but displays the auto-generated value when left blank (shown as placeholder).

---

## 4. Architectural Design

### 4.1 Domain Layer Changes

#### `SnapReceiptDTO` (in `SnapReceiptUseCase.ts`)
Add `vendorId: string` (required field). Keep `vendor: string` for the display name.

```ts
export interface SnapReceiptDTO {
  vendorId: string;      // NEW — Contact.id
  vendor: string;        // display name (unchanged)
  amount: number;
  date: string;          // ISO-8601
  paymentMethod: Payment['method'];
  projectId?: string;
  category?: string;
  currency?: string;     // default: 'AUD'
  notes?: string;
}
```

#### `InvoiceEntity.create` — auto invoice number & AUD default
- Change the `currency` default from `'USD'` to `'AUD'`.
- When `payload.externalReference` is blank/null/undefined, generate:
  ```ts
  `INV-${YYYYMMDD}-${Math.random().toString(36).slice(2,8).toUpperCase()}`
  ```
  where `YYYYMMDD` is derived from `dateIssued` (or `now` if absent).

#### `ReceiptRepository` (domain interface)
Add a second method:

```ts
export interface ReceiptRepository {
  createReceipt(invoice: Invoice, payment: Payment): Promise<{ invoice: Invoice; payment: Payment }>;
  createUnpaidInvoice(invoice: Invoice): Promise<Invoice>;  // NEW
}
```

### 4.2 Application Layer Changes

#### `SnapReceiptUseCase.execute`
- Validate `vendorId` is non-empty (throw `'Vendor is required'`).
- Validate ISO date format (throw `'Date must be a valid ISO date'` on `isNaN(Date.parse(input.date))`).
- Pass `currency: input.currency ?? 'AUD'`.
- Store `vendorId` in `Invoice.metadata` field pending a schema column (`{ ...existing metadata, vendorId: input.vendorId }`).  
  *Future migration can promote `vendorId` to a dedicated column.*

No new use case file needed for "create unpaid invoice" at this stage — callers invoke `ReceiptRepository.createUnpaidInvoice` directly from the existing `ProcessInvoiceUploadUseCase` (or a new thin `CreateUnpaidInvoiceUseCase` if one is needed — defer decision to implementation).

### 4.3 Infrastructure Layer Changes

#### `DrizzleReceiptRepository`
1. Existing `createReceipt` — add project aggregate update inside the transaction:
   ```sql
   UPDATE projects
   SET total_payments = total_payments + ?,
       updated_at     = ?
   WHERE id = ?
   ```
   Guard with `if (invoice.projectId)`.

2. New `createUnpaidInvoice(invoice: Invoice)`:
   - `BEGIN TRANSACTION`
   - `INSERT INTO invoices … (status='issued', payment_status='unpaid')`
   - If `invoice.projectId`: `UPDATE projects SET pending_payments = pending_payments + ?, updated_at = ? WHERE id = ?`
   - `COMMIT` / `ROLLBACK` on error.
   - Returns the inserted `Invoice` object.

> Note: `total_payments` and `pending_payments` columns must exist on the `projects` table. If not present, add a Drizzle migration as part of this issue (`npm run db:generate`). Verify in `schema.ts` before implementation.

### 4.4 UI Layer Changes

#### New component: `ContractorLookupField`
**Location**: `src/components/inputs/ContractorLookupField.tsx`

A controlled field that:
- Renders a read-only `Pressable` showing the selected contractor name (or a placeholder).
- Tapping opens `SubcontractorPickerModal`.
- Supports `QuickAddContractorModal` for new contractors.
- Props:
  ```ts
  interface ContractorLookupFieldProps {
    label: string;
    value: { id: string; name: string } | null;
    onChange: (contact: { id: string; name: string } | null) => void;
    error?: string;
    testID?: string;
  }
  ```

**Reuse pattern**: mirrors `TaskSubcontractorSection` but as a standalone form field rather than a task-section widget.

#### `ReceiptForm` changes (`src/components/receipts/ReceiptForm.tsx`)
- Replace `vendor` `TextInput` with `<ContractorLookupField>`.
- Add `vendorId` to local form state (`const [vendorId, setVendorId] = useState(...)`).
- Update `validate()` to check `vendorId` is non-empty.
- `handleSubmit` passes `vendorId` in the `SnapReceiptDTO`.
- Remove currency from the form (pass `'AUD'` silently).

#### `InvoiceForm` changes (`src/components/invoices/InvoiceForm.tsx`)
- Replace `vendor` `TextInput` with `<ContractorLookupField>`.
- Add `vendorId` to local form state; pass through to `invoiceData`.
- Default `dateIssued` to `new Date()` when `initialValues.dateIssued` is absent.
- Hide (remove from render tree) the Currency, Subtotal, and Tax `<View>` blocks.
- `externalReference` input: show auto-generated placeholder text (`INV-YYYYMMDD-XXXXXX`) to signal it can be left blank.
- Pass `currency: 'AUD'` hardcoded in `handleSubmit`.

#### Invoice Upload / Snap Invoice screen
- Move `<InvoiceUploadSection>` (or "Upload Invoice PDF" button) to render **before** `<InvoiceForm>` in the screen component.
- Remove any conditional that hides the form body until a PDF is attached — show the form immediately.

---

## 5. Component Sketch

```
[Snap Invoice Screen]
┌─────────────────────────────────────┐
│  ← Back          Snap Invoice       │
├─────────────────────────────────────┤
│  [ Upload Invoice PDF ]  ← NEW top  │
│   📄 No file selected               │
├─────────────────────────────────────┤
│  Invoice Details                    │
│  Invoice Number  [INV-20260327-ABC] │ ← placeholder, auto-generated
│  Vendor *        [Search / Select ▼]│ ← ContractorLookupField
│  Total *         [          0.00  ] │
│  Invoice Date *  [27 March 2026   ] │ ← defaults to today
│  Due Date        [                ]│
│  Notes           [                ]│
│                                     │
│  [  Cancel  ]    [  Save Invoice  ] │
└─────────────────────────────────────┘

[Snap Receipt Screen]
┌─────────────────────────────────────┐
│  ← Back          Snap Receipt       │
├─────────────────────────────────────┤
│  Vendor *        [Search / Select ▼]│ ← ContractorLookupField
│  Total Amount *  [          0.00  ] │
│  Date *          [27 March 2026   ] │
│  Payment Method  [ Card ▼ ]         │
│  Notes           [                ]│
│                                     │
│  [  Cancel  ]    [  Save Receipt  ] │
└─────────────────────────────────────┘
```

---

## 6. Test Plan (TDD)

### Unit Tests

| File | What to test |
|---|---|
| `__tests__/unit/SnapReceiptUseCase.test.ts` | throws when `vendorId` absent; throws when amount ≤ 0; throws on invalid date; stores `currency: 'AUD'`; stores `vendorId` in invoice metadata |
| `__tests__/unit/InvoiceEntity.validation.test.ts` | `create` with blank `externalReference` produces a valid `INV-…` string; default currency is `'AUD'` |
| `__tests__/unit/ContractorLookupField.test.tsx` | renders placeholder; opens picker on press; calls `onChange` with `{id, name}` |
| `__tests__/unit/ReceiptForm.test.tsx` | submit blocked when no vendor selected; passes `vendorId` and `currency:'AUD'` to `onSubmit` |
| `__tests__/unit/InvoiceForm.test.tsx` | currency field absent from render; subtotal/tax fields absent; date defaults to today; submit passes `currency:'AUD'` |

### Integration Tests

| File | What to test |
|---|---|
| `__tests__/integration/DrizzleReceiptRepository.integration.test.ts` | `createReceipt` → invoice row present, payment row present, `projects.total_payments` incremented |
| `__tests__/integration/DrizzleReceiptRepository.integration.test.ts` | `createUnpaidInvoice` → invoice row (status=issued, paymentStatus=unpaid), `projects.pending_payments` incremented |
| `__tests__/integration/DrizzleReceiptRepository.integration.test.ts` | `createUnpaidInvoice` failure → rollback; project row unchanged |

---

## 7. Migration Notes

- If `projects` table lacks `total_payments` / `pending_payments` integer columns, add them:
  ```ts
  // schema.ts addition
  totalPayments: integer('total_payments').default(0),
  pendingPayments: integer('pending_payments').default(0),
  ```
  Run `npm run db:generate` → `npm run db:push` (dev) or include in migrations.
- No change to the `invoices` or `payments` table schema for this issue.

---

## 8. Open Questions

1. Should `vendorId` be promoted to a dedicated column on `invoices` in this issue, or stored in `metadata` and deferred?  
   → Recommended: store in `metadata` now; plan a schema column in a follow-up.
2. Does `ContractorLookupField` need to support free-text entry as a fallback (for vendors not in the contacts list)?  
   → Recommended: yes, via `QuickAddContractorModal` already wired into `SubcontractorPickerModal`.
3. Are `total_payments` / `pending_payments` integer (cents) or decimal?  
   → Use `real` (float) consistent with the existing `payments.amount` column type.

---

## 9. File Change Summary

| File | Action |
|---|---|
| `src/domain/repositories/ReceiptRepository.ts` | Add `createUnpaidInvoice` method |
| `src/domain/entities/Invoice.ts` (InvoiceEntity) | Auto-generate invoiceNumber; default AUD |
| `src/application/usecases/receipt/SnapReceiptUseCase.ts` | Add `vendorId`; validate ISO date; default AUD |
| `src/infrastructure/repositories/DrizzleReceiptRepository.ts` | Add project aggregate updates; add `createUnpaidInvoice` |
| `src/components/inputs/ContractorLookupField.tsx` | **NEW** — contractor lookup form field |
| `src/components/receipts/ReceiptForm.tsx` | Use `ContractorLookupField`; remove currency |
| `src/components/invoices/InvoiceForm.tsx` | Use `ContractorLookupField`; hide currency/subtotal/tax; default date today |
| Invoice upload/snap screen component | Move PDF upload to top; show form by default |
| `src/infrastructure/database/schema.ts` | Add `totalPayments`/`pendingPayments` columns (if absent) |
| `drizzle/migrations/` | Auto-generated migration (if schema changed) |

---

## 10. Handoff

**Next Step**: Start TDD  
**Agent**: developer  
**Prompt**: "Plan approved. Write failing tests for these requirements."  
**Design doc**: `design/#184-minor-issues.md`
