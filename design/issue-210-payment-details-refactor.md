# Design: Issue #210 — PaymentDetails Architecture Refactor (Phase 2)

**Date:** 2026-04-21  
**Branch:** `issue-210-refactor-observability`  
**Author:** Architect agent  
**Reviewed by:** mobile-ui agent (UI layout preserved — see §6)  
**Follows:** `issue-210-ui-architecture-audit.md` Phase 2

---

## 1. Summary

`src/pages/payments/PaymentDetails.tsx` violates Clean Architecture by directly resolving
repositories from the tsyringe DI container, instantiating four use cases inside the UI component
body, encoding complex async loading logic, and computing business-rule derivations in render scope.

We apply the same **View-Model Facade pattern** used successfully for `DashboardScreen` and
`ProjectsPage`. A single hook `usePaymentDetails()` extracts all data-fetching,
action-orchestration, and derived-state logic so the UI component becomes a pure presentation
component that consumes one unified source of truth.

**No visual changes are planned.** Layout, Tailwind tokens, modal styling, and all UX flows are
preserved exactly as-is.

---

## 2. Problem Statement

### 2.1 Violations in `src/pages/payments/PaymentDetails.tsx`

| Line(s) | Violation | Category |
|---------|-----------|----------|
| `container.resolve<PaymentRepository>(...)` | DI container accessed in UI | ❌ Layer breach |
| `container.resolve<InvoiceRepository>(...)` | DI container accessed in UI | ❌ Layer breach |
| `container.resolve<ProjectRepository>(...)` | DI container accessed in UI | ❌ Layer breach |
| `new MarkPaymentAsPaidUseCase(paymentRepo, invoiceRepo)` | Use case instantiated in UI | ❌ Layer breach |
| `new RecordPaymentUseCase(paymentRepo, invoiceRepo)` | Use case instantiated in UI | ❌ Layer breach |
| `new LinkPaymentToProjectUseCase(paymentRepo)` | Use case instantiated in UI | ❌ Layer breach |
| `new LinkInvoiceToProjectUseCase(invoiceRepo)` | Use case instantiated in UI | ❌ Layer breach |
| `import '../../infrastructure/di/registerServices'` | Bootstrap side-effect in UI | ❌ Layer breach |
| `loadData` async callback (50+ lines) | Async orchestration in UI | ⚠️ Poor cohesion |
| `isSyntheticRow`, `canRecordPayment`, etc. | Business rule derivation in UI | ⚠️ Poor cohesion |
| `formatCurrency` / `formatDate` defined at top of file | Formatters duplicated outside utils | ⚠️ Minor |

### 2.2 What is acceptable in the UI layer

| Logic | Verdict |
|-------|---------|
| Rendering JSX sections based on `vm.canRecordPayment` | ✅ Presentation binding |
| Loading / error / empty state rendering | ✅ Pure presentation |
| Modal JSX layout and keyboard-avoidance | ✅ Pure presentation |
| `isDark` / `iconColor` from `useColorScheme` | ✅ Theme binding — stays in UI |

---

## 3. Target Architecture (MVVM-style Hook)

```
PaymentDetails (UI — pure presentation)
  └── usePaymentDetails (View-Model Hook — facade for all data & actions)
        ├── useRoute        (React Navigation — reads paymentId / syntheticRow / invoiceId)
        ├── useNavigation   (React Navigation)
        ├── useQueryClient  (@tanstack/react-query — cache invalidation)
        └── [DI + use-case wiring hidden here]:
              container.resolve → PaymentRepository
              container.resolve → InvoiceRepository
              container.resolve → ProjectRepository
              MarkPaymentAsPaidUseCase
              RecordPaymentUseCase
              LinkPaymentToProjectUseCase
              LinkInvoiceToProjectUseCase
```

### 3.1 Dependency flow (Clean Architecture)

```
UI Layer (PaymentDetails)
  ↓  consumes / delegates to
Hook Layer (usePaymentDetails)
  ↓  resolves repos / instantiates use cases
Application Layer (MarkPaymentAsPaidUseCase, RecordPaymentUseCase, ...)
  ↓  delegates to
Infrastructure Layer (DrizzlePaymentRepository, DrizzleInvoiceRepository, ...)
```

---

## 4. New Abstraction: `usePaymentDetails`

### 4.1 File location

`src/hooks/usePaymentDetails.ts`

### 4.2 Responsibilities

1. **Route params:** Reads `paymentId`, `syntheticRow`, and `invoiceId` from `useRoute()` internally — the UI no longer imports `useRoute`.
2. **Data loading:** Contains the full `loadData` async function; owns `payment`, `invoice`, `linkedPayments`, and `project` state.
3. **Business derivations:** Computes `isSyntheticRow`, `canRecordPayment`, `showMarkAsPaidFallback`, `isPending`, `projectRowInteractive`, `showEditIcon`, `totalSettled`, `remainingBalance`, `resolvedProjectId`, and `dueStatus`.
4. **Modal state:** Owns `projectPickerVisible`, `pendingFormVisible`, `partialModalVisible`, `partialAmount`, and `partialAmountError`.
5. **Action handlers:** `handleMarkAsPaid`, `handlePartialPaymentSubmit`, `handleSelectProject`, `handleNavigateToProject`, `goBack`, `reload`.
6. **Use case wiring:** Instantiates (via `useMemo`) all four use cases from `useMemo`-resolved repositories.
7. **Formatting helpers:** Exposes locale-specific `formatCurrency` (AUD, `en-AU`) and `formatDate` (AU human-readable) as stable function references — _not_ reusing `src/utils/CurrencyUtils.ts` or `src/utils/formatDate.ts` because those use different locales/formats and a silent change would break display output.

### 4.3 Interface (TypeScript)

```typescript
// src/hooks/usePaymentDetails.ts

import { Payment } from '../domain/entities/Payment';
import { Invoice } from '../domain/entities/Invoice';
import { Project } from '../domain/entities/Project';

export interface DueStatus {
  text: string;
  style: 'overdue' | 'due-soon' | 'ok';
}

export interface PaymentDetailsViewModel {
  // ── Core data ────────────────────────────────────────────────────────────
  payment: Payment | null;
  invoice: Invoice | null;
  linkedPayments: Payment[];
  project: Project | null;

  // ── Async states ─────────────────────────────────────────────────────────
  loading: boolean;
  marking: boolean;
  submitting: boolean;

  // ── Derived presentation state ────────────────────────────────────────────
  isSyntheticRow: boolean;
  resolvedProjectId: string | undefined;
  dueStatus: DueStatus | null;
  totalSettled: number;
  remainingBalance: number;
  canRecordPayment: boolean;
  showMarkAsPaidFallback: boolean;
  isPending: boolean;
  projectRowInteractive: boolean;
  showEditIcon: boolean;

  // ── Modal / UI state ──────────────────────────────────────────────────────
  projectPickerVisible: boolean;
  pendingFormVisible: boolean;
  partialModalVisible: boolean;
  partialAmount: string;
  partialAmountError: string;

  // ── Formatting helpers (AUD / en-AU locale) ───────────────────────────────
  formatCurrency: (amount: number) => string;
  formatDate: (iso?: string | null) => string;

  // ── Actions ───────────────────────────────────────────────────────────────
  handleMarkAsPaid: () => void;
  handlePartialPaymentSubmit: () => Promise<void>;
  handleSelectProject: (project: Project | undefined) => Promise<void>;
  handleNavigateToProject: () => void;
  openPartialModal: () => void;
  closePartialModal: () => void;
  setPartialAmount: (amount: string) => void;
  setProjectPickerVisible: (visible: boolean) => void;
  setPendingFormVisible: (visible: boolean) => void;
  goBack: () => void;
  reload: () => void;
}

export function usePaymentDetails(): PaymentDetailsViewModel;
```

---

## 5. Changes to `PaymentDetails.tsx`

### 5.1 Imports completely cleaned up

**Delete ALL of these from the UI component:**

```typescript
// REMOVE — moved into usePaymentDetails:
import { useEffect, useState, useCallback, useRef } from 'react';  // only React needed for JSX
import { useQueryClient } from '@tanstack/react-query';
import { useRoute, useNavigation, CommonActions } from '@react-navigation/native';
import { container } from 'tsyringe';
import { Payment } from '../../domain/entities/Payment';
import { Invoice } from '../../domain/entities/Invoice';
import { Project } from '../../domain/entities/Project';
import { PaymentRepository } from '../../domain/repositories/PaymentRepository';
import { InvoiceRepository } from '../../domain/repositories/InvoiceRepository';
import { ProjectRepository } from '../../domain/repositories/ProjectRepository';
import { MarkPaymentAsPaidUseCase } from '../../application/usecases/payment/MarkPaymentAsPaidUseCase';
import { RecordPaymentUseCase } from '../../application/usecases/payment/RecordPaymentUseCase';
import { LinkPaymentToProjectUseCase } from '../../application/usecases/payment/LinkPaymentToProjectUseCase';
import { LinkInvoiceToProjectUseCase } from '../../application/usecases/invoice/LinkInvoiceToProjectUseCase';
import { getDueStatus } from '../../utils/getDueStatus';
import { invalidations } from '../../hooks/queryKeys';
import '../../infrastructure/di/registerServices';
```

**Keep only these imports in the UI file:**

```typescript
import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Alert, StyleSheet, Modal, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Pencil, X, DollarSign } from 'lucide-react-native';
import { useColorScheme } from 'nativewind';
import { usePaymentDetails } from '../../hooks/usePaymentDetails';
import { PendingPaymentForm } from '../../components/payments/PendingPaymentForm';
import { ProjectPickerModal } from '../../components/shared/ProjectPickerModal';
```

### 5.2 Component body changes

**Before** (~50 lines of wiring, state, and callbacks):

```typescript
const route = useRoute<any>();
const navigation = useNavigation<any>();
const { colorScheme } = useColorScheme();
const isDark = colorScheme === 'dark';
const iconColor = isDark ? '#e4e4e7' : '#18181b';
const queryClient = useQueryClient();

const { paymentId, syntheticRow, invoiceId: invoiceIdParam } = route.params as { ... };
const [payment, setPayment] = useState<Payment | null>(syntheticRow ?? null);
// ... 9 more useState calls
const paymentRepo = React.useMemo(() => container.resolve(...), []);
// ... 3 more useMemo repo resolutions
const markPaidUc = React.useMemo(() => new MarkPaymentAsPaidUseCase(...), [...]);
// ... 3 more useMemo use case instantiations
const loadData = useCallback(async () => { /* 50+ lines */ }, [...]);
const handleSelectProject = useCallback(async (...) => { /* 20 lines */ }, [...]);
// ... more callbacks, useEffects, derived variables
```

**After** (3 lines):

```typescript
const vm = usePaymentDetails();
const { colorScheme } = useColorScheme();
const isDark = colorScheme === 'dark';
const iconColor = isDark ? '#e4e4e7' : '#18181b';
```

### 5.3 JSX reference mapping

| Before | After |
|--------|-------|
| `loading` | `vm.loading` |
| `payment` | `vm.payment` |
| `invoice` | `vm.invoice` |
| `linkedPayments` | `vm.linkedPayments` |
| `project` | `vm.project` |
| `marking` | `vm.marking` |
| `submitting` | `vm.submitting` |
| `isSyntheticRow` | `vm.isSyntheticRow` |
| `dueStatus` | `vm.dueStatus` |
| `canRecordPayment` | `vm.canRecordPayment` |
| `totalSettled` | `vm.totalSettled` |
| `remainingBalance` | `vm.remainingBalance` |
| `showMarkAsPaidFallback` | `vm.showMarkAsPaidFallback` |
| `isPending` | `vm.isPending` |
| `projectRowInteractive` | `vm.projectRowInteractive` |
| `showEditIcon` | `vm.showEditIcon` |
| `resolvedProjectIdInRender` | `vm.resolvedProjectId` |
| `projectPickerVisible` | `vm.projectPickerVisible` |
| `pendingFormVisible` | `vm.pendingFormVisible` |
| `partialModalVisible` | `vm.partialModalVisible` |
| `partialAmount` | `vm.partialAmount` |
| `partialAmountError` | `vm.partialAmountError` |
| `setProjectPickerVisible(true/false)` | `vm.setProjectPickerVisible(true/false)` |
| `setPendingFormVisible(true/false)` | `vm.setPendingFormVisible(true/false)` |
| `setPartialModalVisible(false)` | `vm.closePartialModal()` |
| `setPartialAmount(...) + setPartialAmountError('')` | `vm.setPartialAmount(...)` (error cleared automatically) |
| `handleMarkAsPaid` | `vm.handleMarkAsPaid` |
| `handleSelectProject` | `vm.handleSelectProject` |
| `handleNavigateToProject` | `vm.handleNavigateToProject` |
| `navigation.goBack()` | `vm.goBack()` |
| `formatCurrency(...)` | `vm.formatCurrency(...)` |
| `formatDate(...)` | `vm.formatDate(...)` |
| `handlePartialPaymentSubmit` | `vm.handlePartialPaymentSubmit` |

---

## 6. UI Design Constraints (mobile-ui agent review)

The following constraints are **non-negotiable** and must be preserved exactly:

- **Three-section scrollable layout:** Amount+Status card → Invoice card → Details card (with interactive Project row) → Payment History card → CTA buttons.
- **Partial Payment bottom-sheet modal:** `Modal + KeyboardAvoidingView` with `animationType="slide"` and `transparent` overlay. The handle bar, amount input with `DollarSign` icon, and two-button footer are all preserved.
- **`ProjectPickerModal` integration:** Receives `visible`, `currentProjectId`, `onSelect`, `onNavigate`, and `onClose` props unchanged.
- **`PendingPaymentForm` integration:** Receives `visible`, `payment`, `onClose`, and `onSaved` (which calls `vm.reload()` after close) props unchanged.
- **Dark mode bindings:** `isDark` and `iconColor` remain computed in the UI component from `useColorScheme` — this is a theme concern, not a business concern, so it stays out of the View-Model.
- **Conditional header edit icon:** The `<Pencil>` icon visibility is controlled by `vm.showEditIcon`.

---

## 7. File Change Inventory

| File | Change Type | Summary |
|------|-------------|---------|
| `src/hooks/usePaymentDetails.ts` | **New file** | View-Model facade: DI wiring, use case instantiation, async data loading, derived state, action handlers, formatting helpers |
| `src/pages/payments/PaymentDetails.tsx` | **Refactor** | Pure UI: consumes `usePaymentDetails()` only; removes all 7 infrastructure/application/domain-repository imports and `tsyringe` container access |

---

## 8. TDD Acceptance Criteria

### 8.1 `usePaymentDetails` unit tests (`__tests__/unit/hooks/usePaymentDetails.test.ts`)

Test setup: Mock `useRoute`, `useNavigation`, `useQueryClient`, and all four use case classes. Provide stub implementations for all repositories.

- [ ] **Loading state:** Returns `loading: true` before `loadData` resolves when `paymentId` is provided without `syntheticRow`.
- [ ] **Synthetic row pre-population:** When `syntheticRow` is provided as route param, `vm.payment` equals that row and `loading: false` immediately.
- [ ] **Standalone payment load:** `paymentRepo.findById` is called with `paymentId`; returned data populates `vm.payment`.
- [ ] **Invoice-only path:** When only `invoiceId` param is provided, `invoiceRepo.getInvoice` and `paymentRepo.findByInvoice` are called; a synthetic `Payment` is constructed and `vm.payment` is non-null.
- [ ] **isSyntheticRow:** `true` when `payment.id.startsWith('invoice-payable:')`.
- [ ] **canRecordPayment:** `true` when invoice is non-null, not cancelled, paymentStatus is `'unpaid'` or `'partial'`, and `remainingBalance > 0`.
- [ ] **canRecordPayment:** `false` when invoice is null.
- [ ] **canRecordPayment:** `false` when `invoice.status === 'cancelled'`.
- [ ] **showMarkAsPaidFallback:** `true` only for non-synthetic pending payments with no linked invoice.
- [ ] **showEditIcon:** `true` only for `isPending && !isSyntheticRow`.
- [ ] **totalSettled:** Sum of `linkedPayments` filtered by `status === 'settled'`.
- [ ] **remainingBalance:** `invoice.total - totalSettled` when invoice is non-null; `0` otherwise.
- [ ] **handleMarkAsPaid (invoice path):** Calls `recordPaymentUc.execute` with a new payment id, `invoiceId`, full remaining balance, and `status: 'settled'`.
- [ ] **handleMarkAsPaid (standalone path):** Calls `markPaidUc.execute({ paymentId })` for a non-synthetic pending payment with no invoice.
- [ ] **handlePartialPaymentSubmit (valid):** Calls `recordPaymentUc.execute` with the partial amount and clears modal state on success.
- [ ] **handlePartialPaymentSubmit (invalid amount = 0):** Sets `partialAmountError` with a validation message; does NOT call `recordPaymentUc.execute`.
- [ ] **handlePartialPaymentSubmit (amount > balance):** Sets `partialAmountError`; does NOT call `recordPaymentUc.execute`.
- [ ] **handleSelectProject (real payment):** Calls `linkPaymentUc.execute({ paymentId, projectId })`.
- [ ] **handleSelectProject (synthetic row):** Calls `linkInvoiceUc.execute({ invoiceId, projectId })`.
- [ ] **goBack:** Calls `navigation.goBack()`.
- [ ] **handleNavigateToProject:** Dispatches `CommonActions.navigate` to `'Projects'` → `'ProjectDetail'` with `resolvedProjectId`.
- [ ] **setPartialAmount:** Updating amount clears `partialAmountError` to `''`.

### 8.2 `PaymentDetails` UI import-layer test (`__tests__/unit/pages/PaymentDetailsScreen.test.tsx`)

- [ ] UI renders completely mock-driven from `usePaymentDetails()` hook injected values.
- [ ] Zero `infrastructure/`, `application/`, `domain/repositories/` imports exist in `PaymentDetails.tsx`.
- [ ] `container` from `tsyringe` is NOT imported in `PaymentDetails.tsx`.
- [ ] `useRoute`, `useNavigation`, `useQueryClient` are NOT imported directly in `PaymentDetails.tsx`.

---

## 9. Migration Notes for Existing Tests

The existing test file `__tests__/unit/PaymentDetails.project.test.tsx` mounts the real
`PaymentDetails` component, directly stubs the `container.resolve` calls, and provides
full mock implementations of the four use cases.

After the refactor, that test should be **migrated** to mock `usePaymentDetails` instead:

```typescript
// OLD pattern (mocking the full DI container):
jest.mock('../../src/infrastructure/di/registerServices', () => ({}));
container.register('PaymentRepository', { useValue: mockPaymentRepo });
// ...

// NEW pattern (mocking the single hook):
jest.mock('../../src/hooks/usePaymentDetails', () => ({
  usePaymentDetails: jest.fn(),
}));
mockUsePaymentDetails.mockReturnValue({ ...vmFixture });
```

This aligns `PaymentDetails.project.test.tsx` with the `DashboardScreen.test.tsx` pattern.
