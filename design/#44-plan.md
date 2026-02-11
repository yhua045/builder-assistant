# Plan: Invoice Module Implementation (Issue #44)

## Goal
Design and implement the Invoice module (aggregate) covering repository layer, domain use cases, and payment management.

## 1. Domain Layer Updates

### 1.1 Entities
- **Invoice**:
  - Review `src/domain/entities/Invoice.ts`.
  - Update `InvoiceStatus` to align with requirements: 'draft', 'received', 'paid', 'overdue', 'voided' (was 'cancelled').
  - Ensure `InvoiceLineItem` structure supports requirements.
  - Check validation rules (e.g. total = sum of line items).
- **Payment**:
  - Review `src/domain/entities/Payment.ts`.
  - Ensure it supports detailed attributes (method, reference, etc.).

### 1.2 Repositories
- **IInvoiceRepository**:
  - Update `src/domain/repositories/InvoiceRepository.ts` to match the proposed interface.
  - Methods: `save`, `findById`, `findAll`, `delete`, `findByProject`, `findByExternalKeys`, etc.
- **IPaymentRepository**:
  - Update `src/domain/repositories/PaymentRepository.ts`.
  - Methods: `save`, `findById`, `findByInvoice`, `delete`, etc.

## 2. Infrastructure Layer Updates

### 2.1 Database Schema
- Review `src/infrastructure/database/schema.ts`.
- Ensure `invoices` and `payments` tables match the entities.
- Update `status` enums if changed in Domain.
- Create migration if schema changes.

### 2.2 Drizzle Repositories
- **DrizzleInvoiceRepository**:
  - Implement `src/infrastructure/repositories/DrizzleInvoiceRepository.ts`.
  - Implement all methods defined in `IInvoiceRepository`.
  - Map between Drizzle schema and Domain entities.
- **DrizzlePaymentRepository**:
  - Implement `src/infrastructure/repositories/DrizzlePaymentRepository.ts`.
  - Implement all methods defined in `IPaymentRepository`.

## 3. Application Layer (Use Cases)

Create use cases in `src/application/usecases/invoice/` and `src/application/usecases/payment/`.

### 3.1 Core Invoice CRUD
- `CreateInvoiceUseCase`
- `UpdateInvoiceUseCase`
- `GetInvoiceByIdUseCase`
- `ListInvoicesUseCase`
- `DeleteInvoiceUseCase` (Archive)

### 3.2 Payment Management
- `RecordPaymentUseCase`
- `ListPaymentsForInvoiceUseCase`
- `GetPaymentByIdUseCase`
- `DeletePaymentUseCase` (Void)

### 3.3 Lifecycle & Status
- `MarkInvoiceAsPaidUseCase`
- `MarkInvoiceAsOverdueUseCase`
- `VoidInvoiceUseCase`

### 3.4 Business Operations (Phase 4 - prioritized later or if time permits)
- `LinkInvoiceToProjectUseCase`
- `CalculateInvoiceBalanceUseCase`

## 4. Testing Strategy
- **Unit Tests**:
  - Test Use Cases with mocked repositories.
  - Test Entities for domain logic (e.g. validations).
- **Integration Tests**:
  - Test Drizzle repositories with real (in-memory) database.
  - Verify schema constraints and queries.

## 5. Implementation Steps
1.  **Refine Domain**: Update Entities and Repository Interfaces.
2.  **Update Schema**: Adjust Drizzle schema if needed and generate migration.
3.  **Implement Repositories**: Create Drizzle implementations.
4.  **Implement Use Cases**: Create and test core use cases.
5.  **Payment Logic**: Implement payment recording and balance updates.

## 6. Questions/Clarifications
- Status 'receive' vs 'sent': Will use 'received' consistent with requirements.
- Status 'cancelled' vs 'voided': Will use 'voided'.
- `projectId` in Invoice: is optional (Schema says optional, issue says "Project [optional]", but usually linked).
