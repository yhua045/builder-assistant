# Design: Vendor/Contractor Details on Quotation Acceptance

**Status**: Approved & Implemented  
**Date**: 2026-03-13  
**Author**: GitHub Copilot  
**Area**: Domain — Quotation, Invoice, Task, Contact  

---

## 1. Problem Statement

When a Quotation transitions to `accepted` status, or when an Invoice is auto-created from a variation task, the linked financial record should carry meaningful contractor/vendor identity:

- **`vendorName`**, **`vendorAddress`**, **`vendorEmail`**, **`contactId`** (on Quotation)
- **`issuerName`**, **`issuerAddress`**, **`issuerTaxId`**, **`recipientId`** (on Invoice)

Currently, these fields are either unpopulated or populated ad-hoc (only `issuerName` is written in `useTaskForm.ts`). This creates the "Unknown Contractor" problem in the Payments screen and means financial records are incomplete for audit trail and display purposes.

---

## 2. Current State Audit

### 2.1 Quotation entity (`src/domain/entities/Quotation.ts`)
```
vendorId?      — contactId alias
contactId?     — alias for vendorId
vendorName?    — free text, optional
vendorAddress? — free text, optional
vendorEmail?   — free text, optional
```
**No `taskId` foreign key. No `documentId` for parsed-from-document path.**

### 2.2 Invoice entity (`src/domain/entities/Invoice.ts`)
```
issuerName?    — free text
issuerAddress? — free text
issuerTaxId?   — free text
recipientId?   — contact FK (builder = recipient)
contactId?     — legacy alias
quoteId?       — soft FK to quotation (not currently set on auto-created invoices)
metadata{}     — arbitrary JSON (currently used for paymentCategory, source, subcontractorId, contractorName)
```
**No `taskId` foreign key. `quoteId` never populated today.**

### 2.3 `quotations` DB table (`src/infrastructure/database/schema.ts`)
Missing: `task_id`, `document_id`

### 2.4 `invoices` DB table
Missing: `task_id`, `quote_id` (soft FK already in entity but not in DB schema)

### 2.5 Contractor data source
- **`useContacts` hook** — in-memory stub of 3 contacts; the only way to resolve a subcontractor name from an ID right now
- **`Contact` entity** — has `name`, `email`, `address`, `phone`; no ABN/tax-id field yet
- **`ContactRepository`** — interface exists but **not registered in DI container**; no Drizzle implementation wired

---

## 3. Quotation Origin Flows

```
Flow A: Variation task (manual input)
  User fills Task Form → sets quoteAmount + subcontractorId
  → useTaskForm: computeQuoteStatus() = 'accepted' (variation + positive amount)
  → invoiceRepository.createInvoice() auto-creates Invoice (quoteInvoiceId written to Task)
  → Quotation record: NOT currently created in this path

Flow B: Contract work (document upload)
  User uploads a PDF/scan → OCR parses it
  → Creates a Quotation record with vendorName/Address from parsed document
  → (Design intent) creates Task with taskType='contract_work'
  → Quotation.status transitions to 'accepted' upon builder approval
  → Invoice may or may not be auto-created

Flow C (future): Direct quotation upload (no prior task)
  User uploads quotation document
  → OCR parsing extracts amount, vendor details
  → System creates Task + Quotation atomically
  → Subcontractor may not be identifiable as a Contact record
```

---

## 4. Core Problem: Vendor Resolution Priority

When accepting a quotation (or auto-creating an invoice), vendor details should be resolved via this **priority chain**:

```
1. Task.subcontractorId → Contact record (name, email, address, phone)
2. Quotation.vendorName / vendorAddress / vendorEmail (document-parsed)
3. (Future) OCR-extracted vendor fields from document scan
4. Placeholder: 'Unknown Vendor' (should not reach production)
```

---

## 5. Proposed Architecture

### 5.1 New abstraction: `VendorDetailsResolver` (Domain Service)

Introduce a lightweight **domain service** (pure function / class) that encapsulates the resolution priority chain. Lives in `src/domain/services/`.

```typescript
// src/domain/services/VendorDetailsResolver.ts

export interface ResolvedVendorDetails {
  vendorId?: string;       // Contact.id if resolved from contacts
  vendorName: string;      // Display name (never empty — always has a fallback)
  vendorAddress?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  source: 'contact' | 'quotation_document' | 'ocr' | 'unknown';
}

export interface VendorResolutionContext {
  subcontractorId?: string;         // Task.subcontractorId
  contact?: Contact | null;         // Pre-fetched Contact record (optional)
  quotation?: Pick<Quotation,       // Quotation doc metadata
    'vendorId' | 'vendorName' | 'vendorAddress' | 'vendorEmail' | 'contactId'
  > | null;
  ocrExtracted?: {                  // Future: parsed from document
    vendorName?: string;
    vendorAddress?: string;
    vendorEmail?: string;
  } | null;
}

export function resolveVendorDetails(ctx: VendorResolutionContext): ResolvedVendorDetails;
```

This service is **pure** (no I/O, fully testable) and is the single place that contains the priority logic. Callers pre-fetch the data they have; the service just applies the chain.

**Why a domain service and not a hook or utility?**
- It contains a business rule (priority chain is a domain decision, not a UI concern)
- It is reusable from both hooks (UI layer) and use cases (application layer) without coupling to React
- It can be unit-tested trivially without mocking DI

---

### 5.2 Schema additions (two new FK columns)

#### `quotations` table — add `task_id` column
```sql
ALTER TABLE quotations ADD COLUMN task_id TEXT;
-- index
CREATE INDEX IF NOT EXISTS idx_quotations_task ON quotations(task_id);
```

**Why**: enables `QuotationRepository.findByTask(taskId)` without scanning all quotations. Also makes the bi-directional link explicit (Task → Invoice via `quoteInvoiceId`; Task → Quotation via `quotations.task_id`).

#### `invoices` table — add `task_id` and `quote_id` columns
```sql
ALTER TABLE invoices ADD COLUMN task_id TEXT;
ALTER TABLE invoices ADD COLUMN quote_id TEXT;
CREATE INDEX IF NOT EXISTS idx_invoices_task ON invoices(task_id);
CREATE INDEX IF NOT EXISTS idx_invoices_quote ON invoices(quote_id);
```

`quote_id` is the persisted version of the existing `Invoice.quoteId` entity field that is currently orphaned (not in DB schema). `task_id` mirrors the task-to-invoice link without relying solely on `task.quoteInvoiceId`.

---

### 5.3 Entity changes

#### `Quotation` entity — add `taskId`
```typescript
taskId?: string;    // Soft FK to Task; set when quotation is linked to a task
documentId?: string; // Already intended but not in entity; make explicit
```

#### `Invoice` entity — `quoteId` and `taskId` are already in the interface; just need to be persisted (schema addition above covers this).

---

### 5.4 New `ContactRepository` method

Add to `ContactRepository` interface:
```typescript
findById(id: string): Promise<Contact | null>;
```

Then register `DrizzleContactRepository` in the DI container so callers can resolve a Contact from an ID. This also unblocks fixing the `useContacts` in-memory stub.

---

### 5.5 Use Case: `AcceptQuotationUseCase`

New use case in `src/application/usecases/quotation/`:

```typescript
// AcceptQuotationUseCase.ts

interface AcceptQuotationInput {
  quotationId: string;
  taskId?: string;           // Optional — pass when accepting via a task
  contact?: Contact | null;  // Pre-fetched Contact (avoids DI for contact repo)
}

interface AcceptQuotationOutput {
  quotation: Quotation;      // Updated quotation (status='accepted', vendor fields populated)
  invoice: Invoice;          // Created/updated invoice with issuerName etc populated
}

class AcceptQuotationUseCase {
  constructor(
    private readonly quotationRepo: QuotationRepository,
    private readonly invoiceRepo: InvoiceRepository,
    private readonly taskRepo?: TaskRepository,  // Optional — used to read task for vendor lookup
  ) {}

  async execute(input: AcceptQuotationInput): Promise<AcceptQuotationOutput>;
}
```

**Responsibility**: 
1. Load the quotation
2. Resolve vendor details via `resolveVendorDetails()` 
3. Write back vendor fields to quotation record
4. Transition `quotation.status` → `'accepted'`
5. Create (or update) linked invoice with the resolved details
6. If `taskId` provided, update `task.quoteInvoiceId`

This removes the ad-hoc invoice creation that currently lives inside `useTaskForm.ts` and centralises it in an auditable use case.

---

### 5.6 Refactor `useTaskForm.ts`

Replace the inline `invoiceRepository.createInvoice(...)` block with:
```typescript
await acceptQuotationUseCase.execute({
  quotationId: ...,    // may be undefined for pure variation path
  taskId: newTask.id,
  contact: resolvedContact,
});
```

The hook's responsibility shrinks to:
1. Collect form state
2. Invoke use cases
3. Handle success/error feedback

---

### 5.7 Future: Direct Quotation Upload (Flow C)

When quotation is uploaded without a prior task:

```typescript
// New use case: ImportQuotationDocumentUseCase
interface ImportQuotationDocumentOutput {
  task: Task;           // Newly created task (taskType='contract_work')
  quotation: Quotation; // Created quotation (status='draft')
  vendorDetails: ResolvedVendorDetails; // Source = 'ocr' | 'unknown'
}
```

Because `VendorDetailsResolver` accepts `ocrExtracted` in its context, Flow C can populate vendor details from parsed text without any special-casing. If no contact can be identified (`source: 'unknown'`), the UI can surface a "Please link a subcontractor" prompt rather than silently writing "Unknown Vendor".

---

## 6. Data Flow After Change

### Variation task save (Flow A — updated)
```
useTaskForm.handleSubmit()
  ├─ createTaskUseCase / updateTaskUseCase  → Task saved
  └─ AcceptQuotationUseCase.execute({ taskId, contact })
       ├─ resolveVendorDetails({ subcontractorId, contact, quotation: null })
       │    → source: 'contact'  (or 'unknown' if stub contact)
       ├─ invoiceRepo.createInvoice({ issuerName, issuerAddress, ... })
       └─ taskRepo.update({ quoteInvoiceId: invoice.id })
```

### Contract work acceptance (Flow B — updated)
```
Builder taps "Accept" on quotation screen
  └─ AcceptQuotationUseCase.execute({ quotationId, taskId, contact })
       ├─ quotationRepo.findById(quotationId)    → loads Quotation with vendor fields
       ├─ resolveVendorDetails({
       │    subcontractorId: task.subcontractorId,
       │    contact,
       │    quotation: { vendorName, vendorAddress, vendorEmail }
       │  })
       │    → source: 'contact' if contact found, else 'quotation_document'
       ├─ quotationRepo.updateQuotation({ status: 'accepted', vendorName: resolved.vendorName, ... })
       ├─ invoiceRepo.createInvoice({ issuerName: resolved.vendorName, ... })
       └─ taskRepo.update({ quoteInvoiceId: invoice.id })
```

---

## 7. Migration Plan

1. **Schema migration** — add `task_id` to `quotations`, add `task_id` + `quote_id` to `invoices` (both nullable, non-breaking)
2. **Domain** — add `VendorDetailsResolver` service + update entity interfaces
3. **Infrastructure** — update `DrizzleQuotationRepository` and `DrizzleInvoiceRepository` to persist/read new columns; register `DrizzleContactRepository` in DI
4. **Application** — implement `AcceptQuotationUseCase`
5. **Hooks** — refactor `useTaskForm.ts` to delegate to use case
6. **Tests** — unit tests for `resolveVendorDetails()` per source priority; integration test for `AcceptQuotationUseCase`

---

## 8. What We Are NOT Doing (Scope Exclusion)

- **Not** building a full OCR pipeline now — `ocrExtracted` slot in `VendorResolutionContext` is a reserved hook for Flow C; it will be `null` until that feature is built
- **Not** migrating existing Quotation/Invoice rows to populate missing vendor fields retroactively (backfill can be a separate script)
- **Not** building UI for "link subcontractor to quotation" screen — this is a prompt surfaced when `source === 'unknown'`

---

## 9. Open Questions (Do Not Implement Until Resolved)

| # | Question | Impact |
|---|----------|--------|
| Q1 | Should `AcceptQuotationUseCase` also update `Quotation.vendorName` in the DB when source is `'contact'`? (i.e. denormalise contact name into quotation at acceptance time) | Medium — affects whether quotation is self-contained after contact changes | ***Yes***
| Q2 | When a Contact record is updated (name/address changes), should linked Quotations/Invoices be updated too? Or are the values frozen at acceptance time? | Medium — audit integrity | ***Freeze at acceptance time*** (audit trail), but if the contact is updated before acceptance, the latest name will be used (since we resolve at acceptance time)
| Q3 | Is `ABN` (Australian Business Number) a required field on the `Contact` entity for GST-tax invoices? Should `Contact` get an `abn?: string` field now? | Medium — affects `issuerTaxId` propagation | ***No*** we will keep it simple for now; some of the 'trades' do not have a ABN.
| Q4 | Should `ContactRepository` be registered in the DI container now, or should we continue with the `useContacts` in-memory stub until a full contact management screen is built? | Low — currently only 3 demo contacts; stub is sufficient for alpha | **A*** Yes, register `DrizzleContactRepository` now to unblock real contact resolution in `resolveVendorDetails()`. The in-memory stub can be removed once we have real persistence.
| Q5 | The `useContacts` stub returns 3 contacts. Is there a timeline for real contact persistence? If not, `resolveVendorDetails()` will often produce `source: 'unknown'` for non-demo contacts. | Low-Medium | ***A*** Yes, we will register the `DrizzleContactRepository` in the DI container now, which allows `resolveVendorDetails()` to resolve real contacts from the database. This means that as soon as we have any contacts persisted, they will be correctly resolved instead of showing "Unknown Vendor". The in-memory stub can be removed once we have real persistence.

---

## 10. Acceptance Criteria (for implementation ticket)

- [ ] `resolveVendorDetails()` returns correct `source` and resolved fields for all three priority cases
- [ ] Variation task save → Invoice has `issuerName`, `issuerAddress` (if contact has address), populated
- [ ] Contract work acceptance → Invoice and Quotation both have vendor fields populated from contact (when available) or document (fallback)
- [ ] `quotations.task_id` and `invoices.task_id` / `invoices.quote_id` columns exist in DB after migration
- [ ] Payments screen shows resolved contractor name for all invoice-payable rows (no "Unknown Contractor" for demo contacts)
- [ ] All existing unit tests pass; new unit tests for `resolveVendorDetails()` cover all three source cases plus unknown fallback
- [ ] TypeScript strict mode: no new type errors

---

## Appendix: Field Mapping Summary

| Source | `vendorName` / `issuerName` | `vendorAddress` / `issuerAddress` | `vendorEmail` | `contactId` / `vendorId` |
|--------|-----------------------------|------------------------------------|---------------|--------------------------|
| Contact found | `contact.name` | `contact.address` | `contact.email` | `contact.id` |
| Quotation document | `quotation.vendorName` | `quotation.vendorAddress` | `quotation.vendorEmail` | `quotation.vendorId` |
| OCR extracted (future) | `ocrExtracted.vendorName` | `ocrExtracted.vendorAddress` | `ocrExtracted.vendorEmail` | `null` |
| Unknown | `'Unknown Vendor'` | `undefined` | `undefined` | `undefined` |
