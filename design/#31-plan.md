# Plan for Issue #31: Invoice Repository Implementation

This plan outlines the architecture, key abstractions, and implementation details for the `InvoiceRepository`, enabling generic CRUD operations with uniqueness constraints.

## 1. Architecture & Key Abstractions

The implementation follows the Clean Architecture principles already present in the project.

### 1.1 Entities (`src/domain/entities/Invoice.ts`)

The `Invoice` entity will be updated to support the new requirements. Key changes include:
- **Keys**: `id` (internal UUID) and `(externalId, externalReference)` (external unique composite key).
- **Association**: `projectId` becomes OPTIONAL.
- **Fields**: Expanded to include issuer details, line items, status workflow, and audit fields.

```typescript
export interface Invoice {
  id: string;                 // Internal UUID
  projectId?: string;         // Optional link to project
  
  // External Uniqueness
  externalId: string;         // Issuer/Source system ID
  externalReference: string;  // Invoice number from issuer
  
  // Metadata
  issuerName?: string;
  recipientName?: string;
  
  // Financials
  total: number;
  currency: string;
  tax?: number;
  subtotal?: number;
  
  // Lifecycle
  status: 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled';
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'failed';
  
  // Dates
  dateIssued?: string;
  dateDue?: string;
  paymentDate?: string;
  
  // Content & Audit
  documentId?: string;        // Link to PDF/Scan via Document storage
  lineItems?: InvoiceLineItem[];
  metadata?: Record<string, any>;
  
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;         // Soft delete
}
```

### 1.2 Repository Interface (`src/domain/repositories/InvoiceRepository.ts`)

The repository contract will be updated to support the specific access patterns required.

```typescript
export interface InvoiceRepository {
  // Core CRUD
  createInvoice(invoice: Invoice): Promise<Invoice>;
  getInvoice(id: string): Promise<Invoice | null>;
  updateInvoice(id: string, updates: Partial<Invoice>): Promise<Invoice>;
  deleteInvoice(id: string): Promise<void>; // Soft delete prefered
  
  // Search & List
  findByExternalKey(externalId: string, externalReference: string): Promise<Invoice | null>;
  listInvoices(params: InvoiceFilterParams): Promise<{ items: Invoice[]; total: number }>;
  
  // Business Operations
  assignProject(invoiceId: string, projectId: string): Promise<Invoice>;
}

export interface InvoiceFilterParams {
  projectId?: string;
  status?: Invoice['status'][];
  dateRange?: { start: string; end: string };
  limit?: number;
  offset?: number;
}
```

## 2. Error Handling Strategy

### 2.1 Uniqueness & Idempotency
- **Constraint**: The database must enforce `UNIQUE(externalId, externalReference)`.
- **Handling**: `createInvoice` will handle duplicate errors. 
  - If a record exists with the same `(externalId, externalReference)`, the repository can either throw a `DuplicateInvoiceError` or return the existing record (idempotent behavior), depending on configuration or specific API method (e.g., `createOrGet`).
  - For this plan, `createInvoice` will throw `InvoiceAlreadyExistsError` to be explicit, and a separate `upsertInvoice` or logic in the use case can handle the idempotent requirement if needed.

### 2.2 Validation
- **Domain Validation**: The Entity class (or Zod schema if used) will validate:
  - Required fields (`externalId`, `externalReference`).
  - Logic (e.g., `total` = `subtotal` + `tax` if provided).
  - Status transitions (optional, can be in Use Cases).

## 3. Testability

### 3.1 Contract Tests
- We will define a `InvoiceRepository.contract.test.ts` that runs against the implementation (SQLite/Drizzle).
- **Scenarios**:
  - Create invoice with optional project ID.
  - Enforce uniqueness on external keys.
  - Retrieve by ID and External Key.
  - Update status and project assignment.
  - List with filters.
  - Soft delete checks.

### 3.2 Integration Tests
- Verify the Drizzle schema constraints (unique index).
- Test data persistence and retrieval from the actual SQLite database.

## 4. Implementation Steps

1.  **Define Domain Types**: Update `Invoice.ts` and `InvoiceRepository.ts` interfaces.
2.  **Schema Migration**: 
    - Create a new Drizzle schema definition `invoices` in `src/infrastructure/database/schema.ts` (or equivalent).
    - ensure `uniqueIndex` on `externalId` + `externalReference`.
    - Generate migration SQL.
3.  **Implement Repository**: Created `DrizzleInvoiceRepository` implementing the interface.
4.  **Tests**: Write contract tests and verify implementation.
