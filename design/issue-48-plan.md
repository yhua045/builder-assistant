# Plan for Issue #48: Snap Receipt Quick Action

## User Story
As a user, I want to quickly capture a receipt from the dashboard so that I can immediately record an expense and its payment without filling out a full complex invoice form.

## Requirements (Scope)
- **Receipt Form UI**: A form to review/edit extracted receipt details.
- **Navigation**: Accessible from "Snap Receipt" button on Dashboard.
- **Data Persistence**: Creates both an **Invoice** (marked as 'paid') and a **Payment** record in one action.
- **Fields**: Vendor, Date, Total Amount, Payment Method, Currency, Project (optional), Category (optional), etc.
- **Out of Scope**: Camera/OCR (assume manual entry or mock for now).

## Architecture & Implementation

### 1. Application Layer (`src/application/usecases/receipt/`)
- **`SnapReceiptUseCase`**: A new use case to coordinate the atomic creation of an invoice and a payment.
    - **Input**: `SnapReceiptDTO` (vendor, amount, date, paymentMethod, projectId, etc.)
    - **Logic**:
        1. Create an `Invoice` entity with status `paid` and `paymentStatus` `paid`.
        2. Create a `Payment` entity linked to the invoice.
        3. Save Invoice via `InvoiceRepository`.
        4. Save Payment via `PaymentRepository`.
        5. (Optional) Wrap in transaction if supported, or handle failures.

### 2. UI Components (`src/components/receipts/`)
- **`ReceiptForm.tsx`**:
    - Fields: Vendor (required), Date (required), Amount (required), Payment Method (required), Project (optional), Notes.
    - Validation: Amount > 0, Required fields present.
- **`SnapReceiptScreen.tsx`** (in `src/pages/receipts/` or `src/pages/dashboard/`):
    - Hosts `ReceiptForm`.
    - Connects to `SnapReceiptUseCase`.
    - Handles navigation back to Dashboard on success.

### 3. Dashboard Integration
- Add "Snap Receipt" button to `HeroSection` or `QuickActions` in Dashboard.
- Wire navigation to `SnapReceiptScreen`.

## Proposed Work Steps
1.  **Use Case**: Implement `SnapReceiptUseCase`.
2.  **Unit Test**: Test `SnapReceiptUseCase` logic (invoice/payment creation, linking).
3.  **UI Components**: Implement `ReceiptForm` and `SnapReceiptScreen`.
4.  **Integration**: Add navigation and connect to Dashboard.
5.  **Integration Test**: Verify the full flow works (Form -> UseCase -> DB).

## Questions/Notes
- `Invoice` entity needs to support `issuerName` (Vendor).
- `Payment` entity needs `paymentMethod`.
- We assume `RecordPaymentUseCase` logic (updating invoice status) is implicitly handled by setting invoice status to 'paid' initially in `SnapReceiptUseCase`, or we should trigger status update. Since we know it's fully paid, setting it directly is efficient.

## Acceptance Criteria
- [ ] Dashboard has "Snap Receipt" button.
- [ ] "Snap Receipt" opens the Receipt Form.
- [ ] User can enter Vendor, Amount, Date, Payment Method.
- [ ] Saving creates an Invoice (paid) and Payment (completed).
- [ ] Success message is shown.
- [ ] Navigation returns to Dashboard.
