Context Analysis
✅ Existing Implementation:

Quotation domain layer complete (Quotation.ts)
QuotationRepository interface & DrizzleQuotationRepository
All CRUD use cases implemented
Unit & integration tests passing
❌ Missing (This Issue):

QuotationForm UI component
Dashboard "Add Quote" button wiring
Voice input feature (no existing voice infrastructure in codebase)
Proposed Implementation Plan
Following TDD workflow from CLAUDE.md:

Phase 0: Design Document ✏️
Create design/issue-65-quotation-form-ui.md with:

UI mockup/component structure
Form fields mapping to Quotation entity
Voice input approach (need to decide on library)
Acceptance criteria & test scenarios
Phase 1: Form Component (TDD) 🧪
Write failing tests (__tests__/unit/QuotationForm.test.tsx):

Form renders with all required fields
Validation for required fields (client, line items, dates totals)
Save/cancel flows
Initial values population
Implement QuotationForm (src/components/quotations/QuotationForm.tsx):

Reuse patterns from ReceiptForm.tsx
Fields: client (text), line items (dynamic array), quantities/prices (numeric), dates, status, notes
Validation using QuotationEntity.create() for domain rules
Similar modal styling/layout as ReceiptForm
Create hook (src/hooks/useQuotations.ts):

Connect to CreateQuotationUseCase, ListQuotationsUseCase
Manage loading/error states
Pattern similar to useSnapReceipt.ts
Phase 2: Dashboard Integration 🔌
Wire "Add Quote" button:

Update dashboard/index.tsx line 107
Add modal state for QuotationForm (like SnapReceipt pattern)
Create QuotationScreen wrapper (src/pages/quotations/QuotationScreen.tsx)
Test integration:

Dashboard opens form on button click
Form creates quotation and refreshes list
Modal closes on success/cancel
Phase 3: Voice Input Feature 🎤 ⚠️
DECISION NEEDED: No voice infrastructure exists. Options:

Option A: Expo Speech Recognition (Recommended)

Library: expo-speech or @react-native-voice/voice
Minimal, focused on text/numeric field population
Voice → transcription → editable before save
Option B: Defer voice to future ticket

Implement form without voice first
Add voice as enhancement after core functionality proven
Recommendation: Option A with basic implementation

Focus on populating text fields (client name, notes)
Simple numeric transcription (quantity, unit price)
Clear "Speak" button per field with visual feedback
Always allow manual editing of transcription
File Structure
Key Questions for Approval ❓
Voice Input Scope: Should I implement basic voice input now (Option A) or defer to separate ticket (Option B)?

Line Items UI: Should line items be:

Simple array with add/remove buttons (like a receipt)?
Or more complex with drag-to-reorder, templates, etc.?
Client Field: Should this be:

Free text input (simple)?
ContactSelector autocomplete (reuse existing ContactSelector.tsx)?
Status Field: Should users set status (draft/sent/accepted/declined) at creation, or always default to 'draft'?

Acceptance Criteria Summary
✅ QuotationForm component with all fields from Quotation entity
✅ Validation matches QuotationEntity business rules
✅ Dashboard "Add Quote" button opens form
✅ Created quotation appears in list (once list component exists)
⏸️ Voice input deferred to follow-up ticket (requires new dependency)
✅ Unit tests cover validation & rendering
✅ Manual test documented in design doc

---

## Implementation Status (2026-02-17)

### ✅ Completed
- **QuotationForm** ([src/components/quotations/QuotationForm.tsx](../src/components/quotations/QuotationForm.tsx))
  - All fields: reference, vendor info, dates, line items, financials, status, notes
  - Dynamic line items with add/remove and auto-calculation
  - Validation using QuotationEntity
  - NativeWind styling matching app patterns
  
- **useQuotations hook** ([src/hooks/useQuotations.ts](../src/hooks/useQuotations.ts))
  - CRUD operations: create, list, get, update, delete
  - Loading and error state management
  - DrizzleQuotationRepository integration

- **QuotationScreen** ([src/pages/quotations/QuotationScreen.tsx](../src/pages/quotations/QuotationScreen.tsx))
  - Modal wrapper for QuotationForm
  - Alert feedback on success/error

- **Dashboard Integration** ([src/pages/dashboard/index.tsx](../src/pages/dashboard/index.tsx))
  - "Add Quote" quick action wired to open QuotationScreen

- **Tests**
  - Unit tests: [__tests__/unit/QuotationForm.test.tsx](../__tests__/unit/QuotationForm.test.tsx) (8/8 passing)
  - Unit tests: [__tests__/unit/useQuotations.test.tsx](../__tests__/unit/useQuotations.test.tsx)
  - Integration: [__tests__/integration/QuotationScreen.integration.test.tsx](../__tests__/integration/QuotationScreen.integration.test.tsx) (2/2 passing)

### ⏸️ Deferred to Follow-up
- **Voice Input Support**
  - Requires: `@react-native-voice/voice` or `expo-speech` dependency
  - Needs: iOS/Android platform permissions configuration
  - Recommend: Create issue #66 for voice enhancement

### 💡 Implementation Decisions Made
1. **Voice Input**: Deferred (needs new deps + permissions)
2. **Client Field**: Free text (ContactSelector can be added later)
3. **Status on Create**: User-selectable with 'draft' default
4. **Line Items**: Simple add/remove array with auto-calculation

### 🧪 Manual Test Steps
1. Open app and navigate to Dashboard
2. Click "Add Quote" quick action button
3. Fill required fields:
   - Reference: "QT-2026-TEST-001"
   - Client/Vendor: "Test Vendor Inc"
   - Issue Date: Select today's date
   - Total: "1500.00"
4. (Optional) Add line items with description, quantity, unit price
5. Click "Save Quotation"
6. Verify success alert appears
7. Modal closes automatically
