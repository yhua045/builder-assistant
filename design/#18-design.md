# Architecture Design - Modular Domain Plan (Issue #18)

## Overview
This document outlines the architectural plan for evolving the `Project` domain to support a comprehensive build management system. The goal is to introduce modularity and abstraction to minimize coupling between domain entities while supporting features like Quotes, Invoices, Work Variations, Tasks, and Payments.

## Key Goals
1.  **Modularity**: Isolate domain logic into distinct modules (Bounded Contexts).
2.  **Abstraction**: Use interfaces/ports to decouple storage and formatting concerns.
3.  **Traceability**: Link financial and work items to Projects and Contacts.

## High-Level Domain Modules (Bounded Contexts)

We will enable the following primary domains:

1.  **Project Core**: The central aggregate managing the lifecycle of a build.
2.  **People (Contacts)**: Registry of trades, suppliers, and workers.
3.  **Finance**: Everything related to money (Quotes, Invoices, Payments).
4.  **Work**: Execution tracking (Tasks, Variations).
5.  **Documents**: Storage and retrieval of binary assets (PDFs, Images).

## 1. Projects Domain
**Responsibility**: Orchestrates the high-level project container. It holds references to other entities but delegates logic to their respective domains.

**Entities**:
- `Project` (Aggregate Root)
  - `id`: string (UUID)
  - `name`: string
  - `siteAddress`: Address
  - `status`: ProjectStatus (Planning, InProgress, Completed, OnHold)
  - `startDate`: date
  - `estimatedCompletionDate`: date

**Key Relationships**:
- 1 Project -> Many Quotes/Invoices (via Finance Domain)
- 1 Project -> Many Tasks (via Work Domain)

## 2. People Domain (Contacts)
**Responsibility**: Manages identity and business verification of external parties.

**Entities**:
- `Contact` (Aggregate Root)
  - `id`: string (UUID)
  - `displayName`: string
  - `type`: ContactType (Trade, Supplier, Architect, Client)
  - `businessDetails`: ValueObject
    - `abn`: string
    - `licenseNumber`: string
    - `insuranceExpiry`: date
  - `contactMethods`: email, phone

## 3. Finance Domain
**Responsibility**: manages the flow of costs and payments.

**Entities**:
- `Quote`
  - `id`: string
  - `projectId`: string (FK)
  - `contactId`: string (FK - The trade providing the quote)
  - `items`: QuoteItem[]
  - `totalAmount`: Money
  - `status`: QuoteStatus (Draft, Sent, Accepted, Rejected)
  - `expiryDate`: date

- `Invoice`
  - `id`: string
  - `projectId`: string (FK)
  - `contactId`: string (FK - The trade billing us)
  - `quoteId`: string (FK - Optional link to original quote)
  - `invoiceNumber`: string (Vendor's ref)
  - `totalAmount`: Money
  - `amountPaid`: Money
  - `dueDate`: date
  - `status`: InvoiceStatus (Draft, Received, Approved, Paid, Overdue)
  - `documentUrl`: string (Link to stored file)

- `Payment`
  - `id`: string
  - `invoiceId`: string (FK)
  - `amount`: Money
  - `date`: date
  - `method`: PaymentMethod (BankTransfer, CreditCard, Cash)
  - `transactionReference`: string

## 4. Work Domain
**Responsibility**: manages the execution of work on site.

**Entities**:
- `Task`
  - `id`: string
  - `projectId`: string (FK)
  - `contactId`: string (FK - Assigned trade)
  - `description`: string
  - `status`: TaskStatus (Pending, InProgress, Completed, ReworkRequired)
  - `schedule`: DateRange
  - `priority`: TaskPriority (Low, Medium, High)

- `WorkVariation` (Changes to scope)
  - `id`: string
  - `projectId`: string
  - `taskId`: string (FK - Associated task)
  - `contactId`: string (FK - Trade requesting/performing variaton)
  - `description`: string
  - `costImpact`: Money (Positive or Negative)
  - `status`: VariationStatus (Proposed, Approved, Rejected)

## 5. Abstraction & Interfaces Strategy

To maintain loose coupling, we will strictly separate Interface (Port) from Implementation (Adapter).

### Repository Interfaces
Each domain root will have a repository interface defined in the domain layer.
- `IProjectRepository`
- `IContactRepository`
- `IQuoteRepository`
- `IInvoiceRepository`
- `IPaymentRepository`
- `ITaskRepository`
- `IWorkVariationRepository`

### Cross-Linking Strategy
Instead of strict database foreign keys or deep object nesting in the domain entities (e.g., `Project.tasks[0].assignee.name`), we will use **ID References**.
- Use `contactId` inside `Task`.
- To display the name, the UI or Application Service will fetch the `Contact` using `IContactRepository.findById(task.contactId)`.
- This prevents loading the entire graph of objects and avoids circular coupling.

## Next Implementation Steps
1.  Define the Types/Interfaces for the entities above in `src/domain/entities`.
2.  Define the Repository interfaces in `src/domain/repositories`.
3.  Implement Drizzle schemas in `src/infrastructure/database/schema` reflecting these relationships.
4.  Update the UI to leverage these refined models (Start with Project Detail View aggregating these lists).

---

## Review of Existing Entities & Missing Foreign Keys

### Analysis Summary (2026-02-05)

After reviewing the existing domain entities in `src/domain/entities/`, I've identified several missing foreign key relationships and confirmed that the `Quote` entity does not exist yet.

### Existing Entity Foreign Key Review

#### ✅ Entities with CORRECT Foreign Keys

1. **Invoice** (`Invoice.ts`)
   - ✅ `projectId: string` - Links to Project
   - ✅ `vendorId?: string` - Links to Contact (trade/vendor)
   - **Status**: Complete

2. **Payment** (`Payment.ts`)
  - ✅ `projectId: string` - Links to Project
  - ✅ `invoiceId?: string` - Links to Invoice
  - ⚠️ `expenseId?: string` - Present in code but treated as a generic source reference; consider deprecating in favour of explicit links
  - **Missing**: `contactId?: string` - Should optionally link to the Contact (payee) for direct payments not tied to invoices
  - **Status**: Needs `contactId` field

3. **Task** (`Task.ts`)
   - ✅ `projectId: string` - Links to Project
   - ✅ `assignedTo?: string` - Links to Contact (worker/trade)
   - **Status**: Complete

4. **WorkVariation** (`WorkVariation.ts`)
  - ✅ `projectId: string` - Links to Project
  - ✅ `requestedBy` / `assignedTo` fields exist in the codebase. These SHOULD be treated as optional contact ID references (i.e. `requestedBy` and `assignedTo` store `contactId` values) to clearly indicate they reference entries in the `Contact` registry.
  - ⚠️ `inspectionId?: string` - Links to Inspection (optional, but should be added if we implement Inspections)
  - **Status**: Complete

5. **Expense** (`Expense.ts`) — DEPRECATED / DUPLICATE
  - The `Expense` entity is considered a duplicate of `Payment` in our model. An "expense" is effectively a payment record that may not link to an `Invoice` or `Contact` (for example, a hardware-store purchase). We will NOT treat `Expense` as a separate domain entity going forward; instead:
  - Use `Payment` for all expense/payment records. For payments without an invoice or contact, `invoiceId` and `contactId` can be omitted and `reference` or a `sourceType`/`sourceUri` field can record provenance.
  - Action: Deprecate `Expense.ts` usage in favour of `Payment` and migrate any logic accordingly.

6. **ChangeOrder** (`ChangeOrder.ts`)
  - ✅ `projectId: string` - Links to Project
  - ✅ `requestedBy?: string` - Links to Contact
  - ✅ `approvedBy?: string` - Links to Contact
  - **Status**: Complete

### Missing Foreign Keys Summary

| Entity | Missing Foreign Key | Reason |
|--------|-------------------|---------|
| **Payment** | `contactId?: string` | To support direct payments to contacts (not always invoice-related) and provide consistent linking across all financial transactions |

### Recommendation: Add `contactId` to Payment

The `Payment` entity should include an optional `contactId` field to:
- Support direct payments to trades/vendors that aren't tied to a specific invoice
- Enable reporting on payments by contact/vendor
- Maintain consistency with Invoice (which has `vendorId`)
- Allow linking deposit payments or advance payments before invoices are issued

**Proposed Change:**
```typescript
export interface Payment {
  id: string;
  localId?: number;
  projectId: string;
  invoiceId?: string;
  contactId?: string;  // NEW: Link to the payee (trade/vendor)
  amount: number;
  date?: string;
  method?: 'bank' | 'cash' | 'check' | 'other';
  status?: 'pending' | 'settled';
  reference?: string;
  createdAt?: string;
  updatedAt?: string;
}
```

---

## Quote Entity Definition

The `Quote` entity is currently **MISSING** from `src/domain/entities/`. Based on the architecture requirements and alignment with existing entities, here is the proposed definition:

### Quote Entity Specification

**Purpose**: Represents a formal price quotation from a trade/vendor for work to be performed on a project.

**Location**: `src/domain/entities/Quote.ts`

**TypeScript Interface**:
```typescript
export interface QuoteLineItem {
  id?: string;
  description: string;
  quantity?: number;
  unitCost?: number;
  total?: number;
  notes?: string;
}

export interface Quote {
  id: string;
  localId?: number; // SQLite INTEGER PRIMARY KEY
  
  // Foreign Keys
  projectId: string;          // Required: Which project is this quote for?
  contactId: string;          // Required: Which trade/vendor provided this quote?
  
  // Quote Details
  quoteNumber?: string;       // Vendor's quote reference number
  title?: string;             // Short description (e.g., "Electrical rough-in")
  description?: string;       // Detailed scope of work
  
  // Line Items & Pricing
  lineItems?: QuoteLineItem[]; // Itemized quote breakdown
  totalAmount: number;         // Total quoted amount
  currency?: string;           // Default 'AUD'
  
  // Status & Lifecycle
  status?: 'draft' | 'sent' | 'received' | 'accepted' | 'rejected' | 'expired';
  issuedDate?: string;        // When the vendor issued the quote
  expiryDate?: string;        // Quote validity period
  acceptedDate?: string;      // When we accepted the quote
  
  // Relationships
  acceptedInvoiceId?: string; // Link to the invoice if quote was accepted and invoiced
  
  // Metadata
  attachments?: string[];     // URLs/paths to quote documents (PDFs, images)
  notes?: string;             // Internal notes about the quote
  createdAt?: string;
  updatedAt?: string;
}

export class QuoteEntity {
  constructor(private readonly _data: Quote) {}

  static create(payload: Omit<Quote, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): QuoteEntity {
    const id = payload.id ?? `quote_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const now = new Date().toISOString();
    const quote: Quote = { 
      ...payload, 
      id, 
      createdAt: now, 
      updatedAt: now,
      status: payload.status ?? 'draft',
      currency: payload.currency ?? 'AUD'
    } as Quote;
    return new QuoteEntity(quote);
  }

  data(): Quote { return { ...this._data }; }
  
  // Domain methods
  isExpired(): boolean {
    if (!this._data.expiryDate) return false;
    return new Date(this._data.expiryDate) < new Date();
  }
  
  isAccepted(): boolean {
    return this._data.status === 'accepted';
  }
}
```

### Quote Field Rationale

| Field | Type | Required | Rationale |
|-------|------|----------|-----------|
| `projectId` | string | ✅ Yes | Every quote must belong to a project |
| `contactId` | string | ✅ Yes | Every quote must come from a specific trade/vendor |
| `quoteNumber` | string | Optional | Vendor's own reference number for tracking |
| `title` | string | Optional | Quick identifier for the type of work |
| `totalAmount` | number | ✅ Yes | Core attribute - the quoted price |
| `status` | enum | Optional | Tracks quote lifecycle (draft → sent → accepted/rejected) |
| `expiryDate` | string | Optional | Many quotes have validity periods (e.g., 30 days) |
| `acceptedInvoiceId` | string | Optional | Links quote to resulting invoice if accepted and work billed |
| `attachments` | string[] | Optional | Store PDF/image references to quote documents |

### Quote Status Workflow

```
draft → sent → received → [accepted|rejected|expired]
                              ↓
                          (link to Invoice)
```

### Use Cases Supported

1. **Quote Collection**: Request quotes from multiple trades for the same scope, compare pricing
2. **Quote Acceptance**: Accept a quote and link it to the subsequent invoice
3. **Quote Expiry Tracking**: Alert when quotes are about to expire
4. **Vendor Comparison**: Compare quotes by contact/trade across projects
5. **Budget Planning**: Sum accepted quotes to forecast project costs

---


