# Issue #67: Invoice Module - CRUD, File Upload/OCR, Lifecycle Operations

**Status**: Planning  
**Created**: 2026-02-17  
**Issue**: https://github.com/yhua045/builder-assistant/issues/67

## 1. User Story

**As a** construction project owner/manager  
**I want to** create, manage, and track invoices with automated data extraction from uploaded documents  
**So that** I can efficiently manage project financials, track payment status, and maintain accurate records without manual data entry.

## 2. Current State Analysis

### Existing Infrastructure ✅
- **Domain Layer**: 
  - `Invoice` entity with validation (`src/domain/entities/Invoice.ts`)
  - `InvoiceRepository` interface (`src/domain/repositories/InvoiceRepository.ts`)
  - Invoice lifecycle states: `draft`, `issued`, `paid`, `overdue`, `cancelled`
  - Payment statuses: `pending`, `partial`, `paid`, `failed`

- **Application Layer**:
  - `CreateInvoiceUseCase`
  - `UpdateInvoiceUseCase`
  - `DeleteInvoiceUseCase`
  - `GetInvoiceByIdUseCase`
  - `ListInvoicesUseCase`

- **Infrastructure Layer**:
  - `DrizzleInvoiceRepository` (Drizzle ORM implementation)
  - OCR infrastructure: `MobileOcrAdapter`, `IOcrAdapter`
  - AI/ML normalizers: `TfLiteReceiptNormalizer`, `DeterministicReceiptNormalizer`
  - Document entity for file attachments

- **Database Schema**:
  - Invoice tables with proper relationships
  - Document storage with OCR text support

### Missing Components ❌
- **UI Layer**:
  - No `InvoiceForm` component
  - No invoice list/detail pages
  - No dashboard integration
  - No file upload UI for invoices
  - No lifecycle action buttons

- **Hooks Layer**:
  - No `useInvoices` hook

- **Application Layer**:
  - No invoice-specific OCR/AI normalizer (can adapt receipt normalizer)
  - No lifecycle transition use cases (mark as paid, cancel, etc.)

## 3. Architecture & Design

### Component Structure

```
src/
├── components/
│   └── invoices/
│       ├── InvoiceForm.tsx          # Main form for CRUD
│       ├── InvoiceLineItemsEditor.tsx  # Line items table
│       ├── InvoiceStatusBadge.tsx   # Status indicator
│       ├── InvoiceUploadSection.tsx # File upload + OCR
│       └── InvoiceLifecycleActions.tsx  # Action buttons
├── pages/
│   └── invoices/
│       ├── InvoiceListPage.tsx      # List view with filters
│       ├── InvoiceDetailPage.tsx    # View/edit single invoice
│       └── index.tsx                # Re-exports
├── hooks/
│   └── useInvoices.ts               # Hook for invoice operations
└── application/
    └── usecases/
        └── invoice/
            ├── MarkInvoiceAsPaidUseCase.ts
            ├── CancelInvoiceUseCase.ts
            └── InvoiceNormalizer.ts  # OCR extraction adapter
```

### UI Design Patterns

Following existing patterns from the codebase:
- **Modal-based forms**: Dashboard "Add Invoice" → Open modal with InvoiceForm
- **Form structure**: Similar to `ReceiptForm` and `ManualProjectEntryForm`
- **Navigation**: Use existing navigation patterns from `dashboard/index.tsx`
- **Hooks**: Follow `useProjects`, `useSnapReceipt` patterns

### Invoice Form Fields

**Core Fields**:
- Invoice Number (auto-generated or manual)
- Client/Contact (dropdown, links to contacts)
- Invoice Date, Due Date
- Status (draft/issued/paid/overdue/cancelled)
- Payment Status (unpaid/partial/paid/failed)
- Currency (default: user's currency)

**Financial Fields**:
- Line Items Editor:
  - Description
  - Quantity
  - Unit Price
  - Tax
  - Total (calculated)
- Subtotal (calculated)
- Tax Total (calculated)
- Grand Total (calculated)

**Additional Fields**:
- Project (optional link)
- Notes (multiline text)
- Tags (chip input)
- Attachments (file upload section)

**Validation Rules** (from existing InvoiceEntity):
- Total must be non-negative
- Due date must be >= issue date
- If line items exist, subtotal must match sum of line items
- Required: total, currency, status, paymentStatus

### File Upload & OCR Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User taps "Upload Invoice" in InvoiceForm               │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. File picker opens (PDF/Image)                           │
│    Accept: .pdf, .jpg, .png                                │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. File uploads to Document storage                        │
│    Create Document entity with type='invoice'              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. OCR/AI Extraction (async)                               │
│    - Use InvoiceNormalizer (adapt ReceiptNormalizer)       │
│    - Extract: invoice #, vendor, dates, line items, total  │
│    - Store extraction status in Document.metadata          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Show Extraction Results Panel                           │
│    - Display extracted fields with confidence indicators   │
│    - Allow manual corrections before saving                │
│    - "Accept & Save" or "Retry Extraction" buttons         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Auto-populate form fields with extracted data           │
│    User can review/edit before final save                  │
└─────────────────────────────────────────────────────────────┘
```

**OCR Extraction Fields** (InvoiceNormalizer):
- Vendor/Issuer name
- Invoice number
- Invoice date
- Due date
- Line items (description, qty, unit price, total)
- Subtotal, tax, total
- Currency (if detectable)

**Fallback**: If OCR fails or extraction incomplete, user can manually enter data.

### Lifecycle Operations

**State Transitions**:

```
draft ──────────────────────> issued ─────────> paid
  │                              │                │
  │                              │                │
  └──> cancelled                 └────> overdue───┘
                                        │
                                        └─────> cancelled
```

**Actions & Use Cases**:

| Action | Current State | Next State | Use Case | UI Location |
|--------|--------------|------------|----------|-------------|
| **Issue Invoice** | draft | issued | `UpdateInvoiceUseCase` | Form, List actions |
| **Mark as Paid** | issued/overdue | paid | `MarkInvoiceAsPaidUseCase` (new) | List quick actions, Detail page |
| **Cancel Invoice** | draft/issued/overdue | cancelled | `CancelInvoiceUseCase` (new) | Detail page |
| **Reopen Invoice** | paid/cancelled | draft | `UpdateInvoiceUseCase` | Detail page (admin) |
| **Mark as Overdue** | issued | overdue | Auto-calculated based on due date | System (no manual action) |
| **Record Payment** | any | partial/paid | Link to Payment entity | Detail page |
| **Archive** | any | N/A (soft delete) | `DeleteInvoiceUseCase` | List, Detail |

**Payment Status Transitions** (separate from main status):
- `unpaid` → `partial` (when payment < total)
- `partial` → `paid` (when payment >= total)
- Any → `failed` (when payment processing fails)

**Business Rules**:
- Auto-mark as `overdue` if status=`issued` and current date > due date
- Cannot delete invoice if status is `paid` (must cancel first)
- Payment status updated via Payment entity linkage
- Audit trail for all status changes (who, when, reason)

### Dashboard Integration

**Add Invoice Button**:
- Location: Dashboard FAB (Floating Action Button) menu
- Action: Open modal with `InvoiceForm` in create mode
- Pattern: Similar to existing Camera/Plus button on dashboard

**Dashboard Widget** (optional, Phase 2):
- "Invoices This Week" section
- Show overdue invoices count
- Quick actions: View all, Create new

## 4. Implementation Plan (TDD Workflow)

### Phase 1: Core CRUD UI (MVP)

**Step 1.1: Invoice Form Component**
- [ ] Create `InvoiceForm.tsx` with all core fields
- [ ] Add form validation (client-side)
- [ ] Support create/edit modes
- [ ] Write unit tests: `InvoiceForm.test.tsx`
  - Renders correctly
  - Validation works
  - Calls onCreate/onUpdate callbacks

**Step 1.2: useInvoices Hook**
- [ ] Create `useInvoices.ts` hook
- [ ] Integrate with existing use cases (Create, Update, Delete, GetById, List)
- [ ] Add loading/error states
- [ ] Write unit tests: `useInvoices.test.tsx`
  - CRUD operations work
  - Error handling
  - State management

**Step 1.3: Invoice List Page**
- [ ] Create `InvoiceListPage.tsx`
- [ ] Display invoices with status badges
- [ ] Add filtering (by status, project)
- [ ] Quick actions: View, Edit, Delete
- [ ] Write unit tests: `InvoiceListPage.test.tsx`

**Step 1.4: Invoice Detail/Edit Page**
- [ ] Create `InvoiceDetailPage.tsx`
- [ ] Show full invoice details
- [ ] Support edit mode
- [ ] Write unit tests: `InvoiceDetailPage.test.tsx`

**Step 1.5: Dashboard Integration**
- [ ] Add "Add Invoice" to dashboard FAB/menu
- [ ] Test modal flow
- [ ] Integration test: Dashboard → Create Invoice

### Phase 2: File Upload & OCR

**Step 2.1: Invoice Upload UI**
- [ ] Create `InvoiceUploadSection.tsx` component
- [ ] File picker for PDF/Image
- [ ] Preview uploaded file
- [ ] Write unit tests

**Step 2.2: Invoice Normalizer (OCR/AI)**
- [ ] Create `InvoiceNormalizer.ts` (adapt from ReceiptNormalizer)
- [ ] Extract invoice-specific fields
- [ ] Add confidence scoring
- [ ] Write unit tests: `InvoiceNormalizer.test.ts`
- [ ] Write integration tests with real OCR

**Step 2.3: Extraction Results Panel**
- [ ] Create UI for showing extracted data
- [ ] Allow manual corrections
- [ ] "Accept & Save" / "Retry" actions
- [ ] Write unit tests

**Step 2.4: Document Storage Integration**
- [ ] Link uploaded files to Document entity
- [ ] Store OCR results in Document.metadata
- [ ] Handle async extraction status
- [ ] Write integration tests

### Phase 3: Lifecycle Operations

**Step 3.1: Lifecycle Use Cases**
- [ ] Create `MarkInvoiceAsPaidUseCase.ts`
  - Validate can transition to paid
  - Update status and paymentStatus
  - Record timestamp and user
  - Write unit tests
- [ ] Create `CancelInvoiceUseCase.ts`
  - Validate can cancel
  - Update status, add cancellation reason
  - Write unit tests

**Step 3.2: Lifecycle Action Buttons**
- [ ] Create `InvoiceLifecycleActions.tsx`
- [ ] Show context-appropriate actions based on current status
- [ ] Confirmation dialogs for destructive actions
- [ ] Write unit tests

**Step 3.3: Payment Integration**
- [ ] Link invoices to Payment entities
- [ ] Auto-update paymentStatus when payments added
- [ ] Show payment history on invoice detail
- [ ] Write integration tests

**Step 3.4: Audit Trail**
- [ ] Store status change history
- [ ] Display timeline on detail page
- [ ] Write tests

### Phase 4: Polish & Edge Cases

**Step 4.1: Overdue Auto-Detection**
- [ ] Background job or hook to mark overdue
- [ ] Show "X days overdue" indicator
- [ ] Write tests

**Step 4.2: Multi-Currency Support**
- [ ] Currency selector in form
- [ ] Display currency symbols correctly
- [ ] Write tests

**Step 4.: Error Handling**
- [ ] Graceful OCR failure handling
- [ ] Network error recovery
- [ ] User-friendly error messages

## 5. Test Acceptance Criteria

### Unit Tests

**InvoiceForm.test.tsx**:
- [ ] Renders all form fields correctly
- [ ] Validates required fields (total, currency, status)
- [ ] Validates due date >= issue date
- [ ] Calculates subtotal/total from line items
- [ ] Calls onCreate with correct data
- [ ] Calls onUpdate with correct data
- [ ] Shows validation errors

**useInvoices.test.tsx**:
- [ ] Creates invoice successfully
- [ ] Updates invoice successfully
- [ ] Deletes invoice successfully
- [ ] Gets invoice by ID
- [ ] Lists invoices with filters
- [ ] Handles errors correctly
- [ ] Updates loading states

**InvoiceNormalizer.test.ts**:
- [ ] Extracts invoice number
- [ ] Extracts vendor/issuer
- [ ] Extracts dates (issue date, due date)
- [ ] Extracts line items
- [ ] Extracts totals (subtotal, tax, total)
- [ ] Returns confidence scores
- [ ] Handles extraction failures gracefully

**MarkInvoiceAsPaidUseCase.test.ts**:
- [ ] Marks invoice as paid
- [ ] Updates paymentStatus to 'paid'
- [ ] Records timestamp
- [ ] Validates invoice exists
- [ ] Prevents marking cancelled invoice as paid

**CancelInvoiceUseCase.test.ts**:
- [ ] Cancels invoice
- [ ] Stores cancellation reason
- [ ] Prevents cancelling already paid invoice (business rule decision needed)
- [ ] Records timestamp

### Integration Tests

**InvoiceForm.integration.test.tsx**:
- [ ] Creates invoice and saves to DB
- [ ] Updates existing invoice in DB
- [ ] Loads invoice from DB for editing

**InvoiceUpload.integration.test.tsx**:
- [ ] Uploads file and creates Document entity
- [ ] Runs OCR extraction
- [ ] Populates form with extracted data
- [ ] Saves invoice with attachment reference

**Dashboard.integration.test.tsx**:
- [ ] "Add Invoice" button opens InvoiceForm
- [ ] Created invoice appears in list

### Manual Test Plan

1. **Create Invoice**:
   - Open app → Dashboard → "Add Invoice"
   - Fill all fields manually
   - Save → Verify appears in list

2. **Upload & OCR**:
   - Create invoice → Upload PDF/image
   - Verify OCR extraction runs
   - Verify extracted data populates form
   - Make corrections → Save
   - Verify attachment linked to invoice

3. **Edit Invoice**:
   - Open existing invoice
   - Modify fields
   - Save → Verify changes persist

4. **Lifecycle Actions**:
   - Create draft invoice
   - Issue invoice → Status changes to "issued"
   - Mark as paid → Status changes to "paid"
   - Create another invoice → Cancel it → Status "cancelled"

5. **Overdue Detection**:
   - Create invoice with due date in past
   - Verify shows as "overdue"
   - Verify "X days overdue" displayed

6. **Delete Invoice**:
   - Delete draft invoice → Removed from list
   - Try to delete paid invoice → Should prevent or require confirmation

## 6. Technical Considerations

### OCR/AI Extraction

**Async Handling**:
- OCR may take 2-10 seconds for complex invoices
- Show loading indicator during extraction
- Allow user to continue working while extraction runs in background
- Notify when extraction completes

**Feature Flag**:
- Add `ENABLE_INVOICE_OCR` feature flag
- If disabled, skip OCR and only allow manual entry
- Useful for phased rollout and testing

**Retry Logic**:
- If extraction fails, allow "Retry" button
- Store extraction attempts in Document.metadata
- After 3 failures, suggest manual entry

### Data Migration

**No schema changes needed** (Invoice table already exists).

If new fields required for lifecycle:
- Add migration for audit trail fields (if not in metadata)
- Migration test to ensure existing invoices compatible

### Privacy & Security

- Invoice PDFs may contain sensitive data (banking info, addresses)
- Store attachments locally initially (don't sync to cloud without encryption)
- Redact PII in OCR logs
- Follow existing Document storage patterns

### Performance

- Invoice list may grow large → Implement pagination
- Use FlatList with `getItemLayout` for fast scrolling
- Lazy load attachments (don't load all PDFs at once)
- Cache OCR results to avoid re-extraction

### Accessibility

- Form labels for screen readers
- Color contrast for status badges
- Touch targets >= 44pt
- Error messages announced to screen readers

## 7. Dependencies & Risks

### Dependencies
- Existing Invoice domain/use cases ✅
- Drizzle repository ✅
- OCR infrastructure ✅
- Document entity ✅
- Navigation system ✅

### Risks

**Risk 1: OCR Accuracy**
- **Mitigation**: Allow manual corrections, show confidence scores, feature flag

**Risk 2: Large PDF Performance**
- **Mitigation**: Async processing, file size limits, streaming upload

**Risk 3: Complex Lifecycle Rules**
- **Mitigation**: Start simple (draft → issued → paid), add complexity incrementally

**Risk 4: Payment Integration Complexity**
- **Mitigation**: Phase 1 = manual status updates, Phase 2 = auto-link payments

## 8. Out of Scope (Phase 2+)

- Email/SMS notifications on status changes
- Payment provider integration (webhooks)
- Client-facing invoice portal
- PDF generation (invoice → PDF)
- Multi-currency conversion rates
- Recurring invoices
- Batch operations (bulk mark as paid)
- Advanced reporting/analytics
- Export to accounting software
- Tax calculation engine

## 9. Success Metrics

**MVP Success Criteria**:
- [ ] Can create invoice manually via dashboard
- [ ] Can upload invoice PDF/image
- [ ] OCR extracts at least 70% of fields correctly
- [ ] Can mark invoice as paid
- [ ] Can cancel invoice
- [ ] All critical paths have tests (>80% coverage)

**User Acceptance**:
- User can create 10 invoices in <5 minutes with OCR
- Zero data loss during save operations
- Responsive UI (<200ms interactions)

## 10. Open Questions for Discussion

1. **Paid Invoice Cancellation**: Should we allow cancelling a paid invoice? We need a "refund/credit note", but this is out of scope for now. For MVP, we can prevent cancelling paid invoices.
2. **Overdue Notifications**: How should we notify users of overdue invoices? In-app only. 
3. **Payment Linkage**: Should we auto-link payments to invoices or require manual selection?
4. **OCR Provider**: Use existing MobileOcrAdapter or integrate cloud OCR (Google Vision, AWS Textract)?
5. **File Storage**: Local only for MVP
6. **Multi-line Item Limits**: Should we limit number of line items (e.g., max 50)?
7. **Status Audit Trail**: Store in Invoice.metadata JSON for now.
8. **Delete vs Archive**: Soft delete invoices for now.

## 11. Next Steps

Once this plan is approved:

1. **Agreement on scope**: Review this plan, clarify open questions
2. **Create tasks**: Break down into GitHub issues/sub-tasks if needed
3. **Start TDD**: Begin with Phase 1, Step 1.1 (InvoiceForm)
   - Write failing tests first
   - Implement minimal code to pass
   - Refactor
4. **Iterate**: Complete each phase, review, adjust

---

**Prepared by**: GitHub Copilot  
**Review Status**: Awaiting approval  
**Related Issues**: #67
