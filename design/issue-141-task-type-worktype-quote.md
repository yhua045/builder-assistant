# Design: Issue #141 — Task Type Toggle (Variation/Contract Work), Work-Type Tracking & Quote-to-Invoice

**Status**: APPROVED — implementation in progress  
**Author**: Copilot  
**Date**: 2026-03-12  
**GitHub Issue**: https://github.com/yhua045/builder-assistant/issues/141

---

## 1. User Stories

| # | Story |
|---|---|
| US-1 | As a Builder, I want the New Task form to default to "Variation" so I can quickly document extra costs while talking to a subbie on-site. |
| US-2 | As a Builder, I want to toggle a task to "Contract Work" and attach a photo/PDF of a physical quote, so I can track the cost against the task. |
| US-3 | As a Builder, I want to tag a task with a Work Type (demolition, framing, pool, etc.) so I can track total spend per trade category. |
| US-4 | As a Builder, I want to mark a received quote as "Accepted" so the app automatically generates an Invoice record without me re-typing the data. |

---

## 2. Acceptance Criteria

| # | Criterion |
|---|---|
| AC-1 | New Task form opens with task type pre-selected to **Variation** by default. |
| AC-2 | Task form shows a three-way toggle: **Standard \| Variation \| Contract Work**. |
| AC-3 | When **Contract Work** is selected, an "Attach Quote" section appears with two actions: *Take Photo* (camera) and *Upload File* (PDF/image). Documents are associated with the task via `Document.taskId` and `Document.type = 'quote'`. |
| AC-4 | When **Contract Work** or **Variation** is selected, a numeric **Quote Amount** field is shown and persisted. |
| AC-5 | The **Work Type** selector is always visible in the task form. The default list includes: Demolition, Storm Water, Pool, Framing, Roofing, Electrical, Plumbing, Tiling, Plastering, Painting, Landscaping, Concrete, Brickwork, Carpentry. A **"+ Custom"** option allows free-text entry. |
| AC-6 | Work Type is persisted on the task record and queryable for cost reporting. |
| AC-7 | When a **Contract Work** task is in edit mode, an **"Accept Quote"** button is shown. Tapping it: (a) sets `quoteStatus = 'accepted'` on the task, (b) creates a new `Invoice` record (status `'issued'`, amount from `quoteAmount`, linked to the task's project and subcontractor), and (c) stores the generated invoice id in `quoteInvoiceId` on the task. |
| AC-8 | After quote acceptance, the task card/detail shows a badge "Invoice Generated" with a link to the invoice. This works the same way for both **Variation** and **Contract Work** tasks. |
| AC-9 | All new fields (`taskType`, `workType`, `quoteAmount`, `quoteStatus`, `quoteInvoiceId`) are persisted and round-trip correctly through the Drizzle repository. |
| AC-10 | TypeScript strict mode passes. Unit tests cover new use cases; integration tests cover repository persistence. |

---

## 3. Current State Analysis

### What already exists

| Concern | Current state |
|---|---|
| `tasks` DB table | Exists; no `task_type`, `work_type`, `quote_amount`, `quote_status`, or `quote_invoice_id` columns. |
| `Task` domain entity | Has `trade?: string` (ad-hoc label) but no formal task-type classification or quote fields. |
| `Document` entity | Has `taskId?: string` and `type?: string` — quote attachments can reuse this with `type = 'quote'`. |
| `TaskDocumentSection` | Existing component; handles generic task file attachments (add/remove). |
| Invoice creation | `InvoiceEntity.create()` + `InvoiceRepository` exist; used by `SnapReceiptUseCase`. |
| Last migration | `0017_repair_task_delay_reason_log_type` — next migration slot is **0018**. |

### Gaps to fill

1. **Schema**: `tasks` table missing 5 new columns.
2. **Domain entity**: `Task` interface missing `taskType`, `workType`, `quoteAmount`, `quoteStatus`, `quoteInvoiceId`.
3. **Use case**: No `AcceptQuoteUseCase` to create an invoice from an accepted quote.
4. **Repository**: `TaskRepository` mapper needs to read/write new columns; no schema change to interface needed (fields are on `Task`).
5. **Hook**: `useTaskForm` needs state for task type, work type, quote amount, and quote status.
6. **UI**: `TaskForm` needs the type toggle, work-type picker, quote amount input, quote attachment section, and Accept Quote button.

---

## 4. Database Schema Changes

### 4.1 New columns on `tasks` table

Five nullable/defaulted `ALTER TABLE` statements — safe in SQLite.

| Column | Type | SQLite type | Default | Notes |
|---|---|---|---|---|
| `task_type` | `'standard' \| 'variation' \| 'contract_work'` | `TEXT` | `'variation'` | Discriminator for the new toggle. Defaults to `'variation'` as required. |
| `work_type` | `string` (free text or predefined key) | `TEXT` | `NULL` | Single work-type label. Stored as a plain string — custom values allowed. |
| `quote_amount` | `number` | `REAL` | `NULL` | Quoted cost in AUD. Only populated for `contract_work` tasks. |
| `quote_status` | `'pending' \| 'issued' \| 'accepted' \| 'rejected'` | `TEXT` | `NULL` | Lifecycle of a contract-work quote. `pending` = no quote data yet; `issued` = quote amount captured; `accepted`/`rejected` = builder decision. |
| `quote_invoice_id` | `string` | `TEXT` | `NULL` | Soft FK to `invoices.id`; set when quote is accepted and invoice auto-generated. |

### 4.2 No new tables

Quote attachments reuse the existing `documents` table with `task_id + type='quote'`.  
No join tables or new entities are required.

### 4.3 Migration — `0018_task_type_work_type_quote`

```sql
ALTER TABLE "tasks" ADD COLUMN "task_type"         text NOT NULL DEFAULT 'variation';
ALTER TABLE "tasks" ADD COLUMN "work_type"          text;
ALTER TABLE "tasks" ADD COLUMN "quote_amount"       real;
ALTER TABLE "tasks" ADD COLUMN "quote_status"       text;
ALTER TABLE "tasks" ADD COLUMN "quote_invoice_id"   text;
```

> All five are backward-compatible (`ADD COLUMN` on nullable/defaulted columns).  
> Existing rows will get `task_type = 'variation'`, which is a safe semantic default.

---

## 5. Domain Layer Changes

### 5.1 `src/domain/entities/Task.ts`

Extend `Task` interface with five new optional fields:

```ts
// Task classification
taskType?: 'standard' | 'variation' | 'contract_work';

// Work/trade category for cost-roll-up reporting
workType?: string;

// Contract Work — quote fields
quoteAmount?: number;           // quoted cost in AUD
quoteStatus?: 'pending' | 'issued' | 'accepted' | 'rejected';
quoteInvoiceId?: string;        // populated after AcceptQuote
```

Export a const for the predefined work-type list (used by UI and tests):

```ts
// src/domain/entities/Task.ts (or src/domain/constants/workTypes.ts)
export const PREDEFINED_WORK_TYPES = [
  'Demolition', 'Storm Water', 'Pool', 'Framing', 'Roofing',
  'Electrical', 'Plumbing', 'Tiling', 'Plastering', 'Painting',
  'Landscaping', 'Concrete', 'Brickwork', 'Carpentry',
] as const;
```

No changes to `TaskEntity.create()` — the spread pattern picks up new fields automatically.

---

## 6. Infrastructure Layer Changes

### 6.1 `src/infrastructure/database/schema.ts`

Add five columns to the `tasks` table Drizzle definition inside `sqliteTable('tasks', { … })`:

```ts
taskType: text('task_type', {
  enum: ['standard', 'variation', 'contract_work'],
}).default('variation'),
workType:        text('work_type'),
quoteAmount:     real('quote_amount'),
quoteStatus:     text('quote_status', {
  enum: ['pending', 'accepted', 'rejected'],
}),
quoteInvoiceId:  text('quote_invoice_id'),
```

### 6.2 `src/infrastructure/database/migrations.ts`

Append migration entry `0018_task_type_work_type_quote` after `0017`:

```ts
{
  tag: '0018_task_type_work_type_quote',
  hash: '0018_task_type_work_type_quote',
  folderMillis: 1773432000000, // 2026-03-12
  sql: [
    `ALTER TABLE "tasks" ADD COLUMN "task_type"       text NOT NULL DEFAULT 'variation';`,
    `ALTER TABLE "tasks" ADD COLUMN "work_type"        text;`,
    `ALTER TABLE "tasks" ADD COLUMN "quote_amount"     real;`,
    `ALTER TABLE "tasks" ADD COLUMN "quote_status"     text;`,
    `ALTER TABLE "tasks" ADD COLUMN "quote_invoice_id" text;`,
  ],
},
```

### 6.3 `DrizzleTaskRepository` mapper

Update the `rowToTask` mapper to read the five new columns and write them in `save()` / `update()`. No interface changes are required — all five fields are part of `Task`.

---

## 7. Application Layer Changes

### 7.1 New use case: `AcceptQuoteUseCase`

**Path**: `src/application/usecases/task/AcceptQuoteUseCase.ts`

**Responsibility**: Given a `taskId`, atomically:
1. Load the task; assert `taskType === 'contract_work'` and `quoteStatus !== 'accepted'`.
2. Load the task's quote-type documents (previews for invoice reference).
3. Create an `Invoice` via `InvoiceEntity.create({ … })` with:
   - `projectId` from the task
   - `total` from `task.quoteAmount ?? 0`
   - `status: 'issued'`
   - `paymentStatus: 'unpaid'`
   - `issuerName` from the subcontractor contact (if linked)
   - `notes` = `"Auto-generated from accepted quote on task: <task.title>"`
   - `dateIssued` = today ISO string
4. Persist the invoice via `InvoiceRepository.saveInvoice(invoice)`.
5. Update the task: `quoteStatus = 'accepted'`, `quoteInvoiceId = invoice.id`, `updatedAt = now`.
6. Persist the task via `TaskRepository.update(task)`.
7. Return `{ task, invoice }`.

**Constructor dependencies** (injected via DI):
```ts
constructor(
  private readonly taskRepo: TaskRepository,
  private readonly invoiceRepo: InvoiceRepository,
  private readonly contactRepo: ContactRepository, // for subcontractor name lookup
)
```

**Error cases**:
- Task not found → throw `'TASK_NOT_FOUND'`
- Not a contract-work task → throw `'NOT_CONTRACT_WORK'`
- Quote already accepted → throw `'QUOTE_ALREADY_ACCEPTED'`

### 7.2 DI registration

Register `AcceptQuoteUseCase` as a singleton in `src/infrastructure/di/registerServices.ts`.

---

## 8. Hook Changes

### 8.1 `src/hooks/useTaskForm.ts`

Add state and setters for the five new fields:

```ts
taskType:    'standard' | 'variation' | 'contract_work'
workType:    string | undefined
quoteAmount: number | undefined
quoteStatus: 'pending' | 'accepted' | 'rejected' | undefined
```

- `taskType` defaults to `'variation'` in `useState` for new tasks.
- All new fields are written into the `Task` payload on `submit()`.

### 8.2 New hook: `src/hooks/useAcceptQuote.ts`

Thin wrapper around `AcceptQuoteUseCase`:

```ts
interface UseAcceptQuoteReturn {
  acceptQuote: (taskId: string) => Promise<{ invoiceId: string }>;
  isAccepting: boolean;
  error: string | null;
}
```

---

## 9. UI / Component Changes

### 9.1 `TaskForm` — task type toggle

Insert immediately below the Title field, before Project:

```
[ Standard ]  [ Variation ✓ ]  [ Contract Work ]
```

- Pill-style toggle consistent with existing Status/Priority row.
- Default: `Variation` pre-selected.
- Toggling triggers conditional section rendering below.

### 9.2 `TaskForm` — Work Type selector

Always visible, positioned after the Project picker.

- Renders as a horizontally-scrollable list of chips for the 14 predefined values.
- A `+ Custom` chip at the end opens a small `TextInput` inline.
- Single-select for v1 (satisfies MVP; multi-select can be added later).
- Selected chip highlighted in primary colour.

### 9.3 `TaskForm` — Contract Work section (conditional)

Shown only when `taskType === 'contract_work'`. Rendered after the Work Type selector:

```
Quote Amount  [ ___________ AUD ]
Attach Quote
  [ 📷 Take Photo ]  [ 📎 Upload File ]
  <attachment preview — filename, size, remove button>
```

- "Take Photo" — reuse `react-native-image-picker` (same as camera task flow in issue #95).
- "Upload File" — reuse `DocumentPicker.pick()` (same as existing `handleAddDocument`).
- Attachments are staged as `PendingDocument` objects (type `'quote'`) and saved when the form submits.
- UI is consistent with `TaskDocumentSection` but labelled separately as "Quote Attachments".

### 9.4 `TaskForm` / `TaskDetailsPage` — Accept Quote button

Shown in **edit mode** when `taskType === 'contract_work'` and `quoteStatus !== 'accepted'`:

```
[ Accept Quote → Generate Invoice ]
```

- Taps `useAcceptQuote.acceptQuote(task.id)`.
- While loading: button shows spinner and is disabled.
- On success: badge "Invoice Generated" replaces the button; shows the invoice ID with a navigation link to `InvoiceScreen`.
- On error: inline error message.

### 9.5 Task list / card display

- Variation tasks: show a small "V" badge (amber) on the task card.
- Contract Work tasks: show a "CW" badge (blue).
- Tasks with accepted quotes: show "Invoice ✓" badge (green).

---

## 10. Test Plan

### Unit tests (`__tests__/unit/`)

| File | Tests |
|---|---|
| `AcceptQuoteUseCase.test.ts` | Creates invoice; sets quoteStatus; stores quoteInvoiceId; throws on wrong taskType; throws if already accepted. |
| `Task.test.ts` (extension) | `TaskEntity.create()` with new fields round-trips correctly; default `taskType` is `'variation'`. |

### Integration tests (`__tests__/integration/`)

| File | Tests |
|---|---|
| `DrizzleTaskRepository.integration.test.ts` (extension) | Saves and reads back all five new columns; existing task rows not broken after migration. |
| `AcceptQuote.integration.test.ts` | Full flow: create contract-work task → accept quote → assert invoice row in DB → assert task updated. |

### UI tests (`__tests__/unit/` — React Test Renderer)

| File | Tests |
|---|---|
| `TaskForm.tasktype.test.tsx` | Form renders with Variation pre-selected; toggling to Contract Work shows quote section; Accept Quote button only in edit mode. |

---

## 11. Open Questions

| # | Question | Proposed default |
|---|---|---|
| OQ-1 | Should Work Type support **multi-select** in v1? | Single-select for simplicity; extend to multi-select in a follow-up if reporting needs it. | **A** Single-select for MVP; multi-select can be added later if needed. |
| OQ-2 | Should quote attachments be shown in the existing `TaskDocumentSection` or as a separate "Quote Attachments" section? | Separate section to avoid visual noise and make the contract-work context clear. | **A** Exisiting `TaskDocumentSection`
| OQ-3 | When a quote is accepted, should the generated Invoice be `'draft'` or `'issued'`? | `'issued'` — builder is confirming the quote, implying it is an active cost commitment. | **A** `'issued'` status to reflect the commitment implied by accepting a quote. |
| OQ-4 | Should "Reject Quote" (`quoteStatus = 'rejected'`) be implemented in this ticket? | In scope — include a "Reject" button alongside Accept. No invoice is created; task stays editable. | **A** Include "Reject" button; no invoice created; task remains editable.
| OQ-5 | Should the `quoteStatus` default to `'pending'` when the user switches to Contract Work? | Yes — auto-set `quoteStatus = 'pending'` when `taskType` changes to `'contract_work'`, null when switched away. | **A** when the user clicks "Save" button, if `taskType === 'contract_work'` and quoteAttachment is attached, quoteAmount is captured, set `quoteStatus = 'issued'`, otherwise set `quoteStatus = 'pending'`. If user switches back to non-contract work and quoteAmount is null, set `quoteStatus = pending`. Otherwise if the quoteAmount is captured, `quoteStatus` should be changed to `issued`.
| OQ-6 | Where should this appear in the app navigation after invoice generation — stay on task, push to InvoiceScreen, or show a modal? | Show a success alert with an "View Invoice" action button (navigate to InvoiceScreen). Stay on Task page after dismiss. | **A** Show a success alert with an "View Invoice" action button (navigate to InvoiceScreen). Stay on Task page after dismiss. The InvoiceScreen will be implemented in a follow-up ticket; for now the link can navigate to a placeholder screen.

---

## 12. Implementation Order (TDD)

Follow the standard TDD workflow from CLAUDE.md:

1. **Domain**: Extend `Task` interface + `PREDEFINED_WORK_TYPES` constant.
2. **Schema + Migration**: Add columns to `schema.ts` + append `0018` entry in `migrations.ts`.
3. **Repository mapper**: Update `DrizzleTaskRepository` mapper; write integration tests (red → green).
4. **Use case**: Write `AcceptQuoteUseCase` tests (red); implement (`AcceptQuoteUseCase.ts`); register in DI.
5. **Hook**: Extend `useTaskForm` state; add `useAcceptQuote` hook.
6. **UI**: Extend `TaskForm` with toggle, work-type picker, and quote section; add UI tests.
7. **Task cards**: Add type badge to task list items.
8. **TypeScript check**: `npx tsc --noEmit` must pass before PR.

---

*Awaiting approval. Please comment with any changes to the open questions above before implementation begins.*
