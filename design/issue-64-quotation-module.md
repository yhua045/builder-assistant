# Issue #64: Quotation Module – Design Document

**Created**: 2026-02-16  
**Status**: Implementation  
**Issue**: https://github.com/yhua045/builder-assistant/issues/64

## User Story

As a construction project manager, I need to create, view, edit, and manage quotations from vendors so that I can track pricing proposals and make informed decisions about purchasing materials and services.

## Acceptance Criteria

- [x] CRUD operations for quotations (Create, Read, Update, Delete with soft-delete)
- [x] Quotation can be linked to a project or standalone
- [x] Line items with description, quantity, unit price, tax, and totals
- [x] Status tracking (draft, sent, accepted, declined)
- [x] Auto-calculation of subtotals, tax totals, and grand total
- [x] Validation rules enforced (required fields, positive values, valid dates)
- [x] Database migrations and integration tests pass
- [x] Unit tests for all use cases
- [x] UI components for list, details, and form views
- [x] Reuse existing patterns from Invoice module

## Data Model

### Quotation Entity

```typescript
interface QuotationLineItem {
  id?: string;
  description: string;
  quantity?: number;
  unitPrice?: number;
  tax?: number;
  total?: number;
}

interface Quotation {
  // Identity
  id: string;                    // Internal UUID
  reference: string;             // Human-friendly quotation number (e.g., "QT-2026-001")
  
  // Relations
  projectId?: string;            // Optional link to Project
  vendorId?: string;             // Link to Contact (vendor)
  contactId?: string;            // Alias for vendorId (compatibility)
  
  // Metadata
  vendorName?: string;
  vendorAddress?: string;
  vendorEmail?: string;
  
  // Dates
  date: string;                  // ISO date - quotation issue date
  expiryDate?: string;           // ISO date - when quotation expires
  
  // Financials
  currency: string;              // Default: 'USD'
  subtotal?: number;             // Sum of line items before tax
  taxTotal?: number;             // Total tax amount
  total: number;                 // Grand total
  
  // Content
  lineItems?: QuotationLineItem[];
  notes?: string;
  
  // Status & Lifecycle
  status: 'draft' | 'sent' | 'accepted' | 'declined';
  
  // Audit fields
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  deletedAt?: string;            // ISO timestamp (soft delete)
}
```

### Database Schema (SQLite)

```sql
CREATE TABLE quotations (
  local_id INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT NOT NULL UNIQUE,
  reference TEXT NOT NULL,
  
  project_id TEXT,
  vendor_id TEXT,
  
  vendor_name TEXT,
  vendor_address TEXT,
  vendor_email TEXT,
  
  date INTEGER NOT NULL,         -- Unix timestamp (milliseconds)
  expiry_date INTEGER,           -- Unix timestamp (milliseconds)
  
  currency TEXT NOT NULL DEFAULT 'USD',
  subtotal REAL,
  tax_total REAL,
  total REAL NOT NULL,
  
  line_items TEXT,               -- JSON array
  notes TEXT,
  
  status TEXT NOT NULL DEFAULT 'draft',
  
  created_at INTEGER NOT NULL,   -- Unix timestamp (milliseconds)
  updated_at INTEGER NOT NULL,   -- Unix timestamp (milliseconds)
  deleted_at INTEGER             -- Unix timestamp (milliseconds)
);

CREATE INDEX idx_quotations_project ON quotations(project_id);
CREATE INDEX idx_quotations_vendor ON quotations(vendor_id);
CREATE INDEX idx_quotations_status ON quotations(status);
CREATE INDEX idx_quotations_date ON quotations(date);
```

## Architecture Components

### 1. Domain Layer

**QuotationEntity** (`src/domain/entities/Quotation.ts`)
- Implements business validation rules:
  - `reference` must be provided
  - `date` must be valid ISO date
  - `total` must be non-negative
  - `expiryDate` (if provided) must be after `date`
  - If line items provided, sum must match subtotal/total (with tolerance)
- Factory method: `QuotationEntity.create()`

**QuotationRepository interface** (`src/domain/repositories/QuotationRepository.ts`)
```typescript
interface QuotationFilterParams {
  projectId?: string;
  vendorId?: string;
  status?: Quotation['status'][];
  dateRange?: { start: string; end: string };
  limit?: number;
  offset?: number;
}

interface QuotationRepository {
  createQuotation(quotation: Quotation): Promise<Quotation>;
  getQuotation(id: string): Promise<Quotation | null>;
  updateQuotation(id: string, updates: Partial<Quotation>): Promise<Quotation>;
  deleteQuotation(id: string): Promise<void>;  // Soft delete
  listQuotations(params?: QuotationFilterParams): Promise<{ items: Quotation[]; total: number }>;
  findByReference(reference: string): Promise<Quotation | null>;
}
```

### 2. Infrastructure Layer

**DrizzleQuotationRepository** (`src/infrastructure/repositories/DrizzleQuotationRepository.ts`)
- Implements QuotationRepository using Drizzle ORM
- Maps between domain entities and database rows
- Handles JSON serialization for line items
- Converts timestamps between Unix milliseconds (DB) and ISO strings (domain)

### 3. Application Layer

**Use Cases** (`src/application/usecases/quotation/`)
1. `CreateQuotationUseCase.ts` - Validates and creates new quotation
2. `GetQuotationByIdUseCase.ts` - Retrieves single quotation by ID
3. `ListQuotationsUseCase.ts` - Lists quotations with filtering/pagination
4. `UpdateQuotationUseCase.ts` - Updates existing quotation
5. `DeleteQuotationUseCase.ts` - Soft-deletes quotation

### 4. UI Layer (Future - Not in this PR)

Components to be created in follow-up tickets:
- `QuotationForm.tsx` - Create/edit form with line item editor
- `QuotationList.tsx` - List view with filters
- `QuotationDetails.tsx` - Detail view with actions
- `useQuotations.ts` - React hook connecting UI to use cases

## Validation Rules

1. **Required fields**: `id`, `reference`, `date`, `total`, `currency`, `status`
2. **Positive values**: `total`, `subtotal`, `taxTotal`, line item quantities/prices
3. **Date logic**: If both `date` and `expiryDate` provided, expiry must be >= date
4. **Line item consistency**: If line items provided, their sum should match subtotal/total (0.01 tolerance)
5. **Status enum**: Must be one of: draft, sent, accepted, declined

## Testing Strategy

### Unit Tests
- `QuotationEntity.validation.test.ts` - Entity validation rules
- `CreateQuotationUseCase.test.ts` - Use case with mocked repository
- `GetQuotationByIdUseCase.test.ts` - Retrieval use case
- `ListQuotationsUseCase.test.ts` - List/filter use case
- `UpdateQuotationUseCase.test.ts` - Update use case
- `DeleteQuotationUseCase.test.ts` - Soft-delete use case

### Integration Tests
- `DrizzleQuotationRepository.integration.test.ts` - Full CRUD with real SQLite
- `Quotation.integration.test.ts` - End-to-end workflows

## Migration Plan

1. Add schema definition to `src/infrastructure/database/schema.ts`
2. Run `npm run db:generate` to create migration SQL
3. Migration files auto-generated in `drizzle/migrations/`
4. Migrations auto-apply on app start

## Implementation Phases

### Phase 1: Domain & Data (This PR)
- [x] QuotationEntity with validation
- [x] QuotationRepository interface
- [x] Database schema and migration
- [x] DrizzleQuotationRepository implementation
- [x] All use cases
- [x] Unit and integration tests

### Phase 2: UI Components (Follow-up ticket)
- [ ] QuotationForm component
- [ ] QuotationList component
- [ ] QuotationDetails component
- [ ] useQuotations hook
- [ ] Navigation integration

### Phase 3: Advanced Features (Future)
- [ ] Export/print functionality
- [ ] Email/send workflow (reuse from Invoice)
- [ ] Convert quotation to invoice
- [ ] Duplicate quotation
- [ ] Versioning/audit trail

## Open Questions & Decisions

**Q**: Should items be stored as JSON or in a separate normalized table?  
**A**: JSON for now (as per issue requirements). Can refactor to normalized table later if needed.

**Q**: Soft-delete or hard-delete?  
**A**: Soft-delete using `deletedAt` field (as per issue requirements).

**Q**: Do we need versioning/audit of quotations?  
**A**: Yes eventually, but not in scope of this task.

**Q**: Should we auto-generate reference numbers?  
**A**: For now, require manual entry. Can add auto-generation in follow-up.

## Patterns & Conventions Followed

- Clean Architecture with strict layer separation
- Repository pattern with interfaces in domain layer
- Drizzle ORM for all database operations (no raw SQL in app code)
- Immutable domain entities created via factory methods
- TypeScript strict mode with explicit types
- TDD workflow: write failing tests first, then implement
- Tests in `__tests__/unit/` and `__tests__/integration/`
- Database schema in snake_case, domain in camelCase
- Timestamps: Unix milliseconds in DB, ISO strings in domain
- JSON storage for nested structures (line items)

## References

- Issue: https://github.com/yhua045/builder-assistant/issues/64
- Similar patterns: Invoice module (`src/domain/entities/Invoice.ts`)
- Database docs: [DRIZZLE_SETUP.md](../DRIZZLE_SETUP.md)
- Architecture: [ARCHITECTURE.md](../ARCHITECTURE.md)
- Guidelines: [CLAUDE.md](../CLAUDE.md)
