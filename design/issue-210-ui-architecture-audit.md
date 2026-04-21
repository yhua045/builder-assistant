# Design: UI Layer Architecture Audit & Refactor Plan

**Date:** 2026-04-21  
**Branch:** `feature/issue-210-refactor-observability`  
**Context:** Following the successful application of the MVVM View-Model Facade pattern to `DashboardScreen`, we conducted a repository-wide audit of the `src/pages/` directory to identify similar Clean Architecture violations.

---

## 1. Summary of Findings

The audit revealed widespread leakage of domain, application, and infrastructure concerns into the UI (React component) layer. Several screens act as "God Components", managing presentation, dependency injection (DI), orchestrating application layer use-cases, and mapping raw domain entities to UI DTOs.

These violations cause the following issues:
1. **Poor Testability:** Difficult to test the UI without mocking complex infrastructure and repositories.
2. **High Coupling:** Changes to business logic or adapters require touching React rendering code.
3. **Bloated Components:** UI files are difficult to read and manage.

---

## 2. Inventory of Architecture Breaches

### 2.1 Direct Infrastructure Instantiation in UI
UI components should not know about specific infrastructure adapters (`MobileXXXAdapter`, `MockXXX`).

| File | Violation |
|------|-----------|
| `src/pages/receipts/SnapReceiptScreen.tsx` | Instantiates `MobileCameraAdapter`, `MobileFilePickerAdapter` |
| `src/pages/invoices/InvoiceScreen.tsx` | Instantiates `MobileFilePickerAdapter`, `MobileFileSystemAdapter` |
| `src/pages/quotations/QuotationScreen.tsx` | Instantiates `MobileFilePickerAdapter`, `MobileFileSystemAdapter` |
| `src/pages/tasks/TaskScreen.tsx` | Instantiates `MockVoiceParsingService`, `MockAudioRecorder` |

### 2.2 Direct Application Use Case Wiring in UI
UI components should delegate actions to a View-Model or Controller, which then coordinates Use Cases. Currently, the UI manually resolves repositories and instantiates Use Cases.

| File | Violation |
|------|-----------|
| `src/pages/payments/PaymentDetails.tsx` | Wires and creates `MarkPaymentAsPaidUseCase`, `RecordPaymentUseCase`, `LinkPaymentToProjectUseCase`, `LinkInvoiceToProjectUseCase` |
| `src/pages/invoices/InvoiceScreen.tsx` | Wires and creates `ProcessInvoiceUploadUseCase` |
| `src/pages/quotations/QuotationScreen.tsx` | Wires and creates `ProcessQuotationUploadUseCase` |
| `src/pages/tasks/TaskDetailsPage.tsx` | Wires and creates `AddTaskDocumentUseCase` |

### 2.3 Data Transformation Leaks
The UI should receive ready-to-render View Models or DTOs. Translating domain logic into display formats inside the View leads to duplicated logic.

| File | Violation |
|------|-----------|
| `src/pages/projects/ProjectsPage.tsx` | Inline `useMemo` manually maps `ProjectDetails` (Domain Entity) to `ProjectCardDto` structure directly in the React component. |

---

## 3. Proposed Refactoring Strategy

We propose replicating the **View-Model Facade pattern** used for `DashboardScreen` across these violating pages.

For each targeted page:
1. **Create a Facade Hook:** e.g., `useProjectsPage.ts`, `usePaymentDetails.ts`, `useSnapReceipt.ts`.
2. **Move Instantiation:** Extract `new Mobile...Adapter()` and `new ...UseCase()` out of the React component and into the custom hook.
3. **Move Data Mapping:** Shift data transformation (e.g., mapping `ProjectDetails` to `ProjectCardDto`) into the hook so the UI only receives the final DTO.
4. **Simplify the UI:** The React component should only call `const vm = useTargetPage()` and bind `vm.data` and `vm.actions` to its templates.

---

## 4. Next Steps & Prioritization

We can tackle these refactorings in phases. Please review and indicate which area to prioritize next:

- [ ] **Phase 1: Projects Page** (`ProjectsPage.tsx`) — Fix the Data DTO mapping leak.
- [ ] **Phase 2: Payment Details** (`PaymentDetails.tsx`) — Fix heavy Application Use Case instantiation.
- [ ] **Phase 3: File / OCR Uploads** (`SnapReceiptScreen`, `InvoiceScreen`, `QuotationScreen`) — Fix Infrastructure Adapter leaks.
- [ ] **Phase 4: Task Screens** (`TaskScreen.tsx`, `TaskDetailsPage.tsx`) — Fix Mock service and document use case leaks.
