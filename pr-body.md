# 🎯 Issue #188: Payments Screen — Quotations, Pending Payments & Priority Ordering

## 📝 Summary

Redesigned the Payments screen to provide unified visibility of quotations, pending payments, and paid payments through a single, intuitive 4-option filter bar. Replaced the two-level Firefighter/Site Manager toggle with a flattened horizontal filter control (Quotations | Pending | Paid | All). Implemented payment-priority ordering for pending payments (overdue → due-soon → due-in-x-days → no-due-date) and paid-date descending sorting for settled payments.

### Key Features

- **PaymentsFilterBar** — 4-option horizontal pill control for tab switching
- **Payment Priority Ordering** — Pending payments sorted by urgency (overdue first)
- **Global Quotations View** — New tab showing all quotations in one place
- **Enhanced Paid Payments** — New tab showing settled payments sorted by payment date (newest first)
- **Unified Search** — Single contractor/vendor search bar applies across all tabs
- **No Schema Changes** — Leverages existing query infrastructure with parameterization

## 🆕 New Files

- `src/components/payments/PaymentsFilterBar.tsx` — 4-option filter bar component
- `src/components/payments/GlobalQuotationCard.tsx` — Compact read-only quotation card for global list
- `src/hooks/useGlobalPaymentsScreen.ts` — Screen-level state + data aggregation
- `src/hooks/useGlobalQuotations.ts` — TanStack Query hook for global quotations
- `src/utils/sortByPaymentPriority.ts` — Pure sorting utilities (priority & date-desc)

## ✏️ Modified Files

- `src/application/usecases/payment/ListGlobalPaymentsUseCase.ts` — Added `status` parameterization
- `src/pages/payments/index.tsx` — Refactored to use new hooks + replaced SegmentedControl
- `src/hooks/queryKeys.ts` — Added global quotations and paid payments query keys
- `src/components/payments/PaymentsSegmentedControl.tsx` — Removed (replaced by PaymentsFilterBar)

## 🧪 Test Coverage

- **32 new unit tests** covering:
  - Payment priority ordering rules (6 tests in `sortByPaymentPriority.test.ts`)
  - Filter state transitions (8 tests in `useGlobalPaymentsScreen.test.tsx`)
  - Global quotations query (4 tests in `useGlobalQuotations.test.tsx`)
  - GlobalQuotationCard rendering (5 tests)
  - Paid payments query (3 tests)
  - Amount payable aggregation (2 tests)

## ✅ Validation Results

- [x] TypeScript Strict Mode — `npx tsc --noEmit` ✅ (0 errors)
- [x] Test Suite — 32 new tests ✅ (all passing)
- [ ] Linting — ⚠️ Pre-existing ESLint warnings (baseline issues, not introduced by this PR)

## 📋 Acceptance Criteria Met

- ✅ AC-1: 4-option filter bar with Pending as default
- ✅ AC-2: Pending shows invoice-payables + pending payments sorted by priority
- ✅ AC-3: Paid shows settled payments sorted by date (newest first)
- ✅ AC-4: All shows pending (priority) + paid (date-desc) combined
- ✅ AC-5: Quotations tab shows global quotations with reference, vendor, total, status, expiry
- ✅ AC-6: AmountPayableBanner shown only for Pending/All tabs
- ✅ AC-7: Search filters all views in real time, case-insensitively
- ✅ AC-8: Empty-state messages for each filter option
- ✅ AC-9: Old PaymentsSegmentedControl removed
- ✅ AC-10: Sorting utilities exported as pure functions
- ✅ AC-11: Comprehensive test coverage
- ✅ AC-12: TypeScript strict check passes

## 🔗 Related Issue

Closes #188

## 🚀 Next Steps

- Manual QA on iOS/Android simulators
- Monitor sorting accuracy with real payment datasets
- Consider UX enhancement: Sort order indicator on active filter