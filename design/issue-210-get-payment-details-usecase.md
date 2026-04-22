# Design: `GetPaymentDetailsUseCase` — Application Layer Extraction

**Date:** 2026-04-21  
**Branch:** `issue-210-refactor-observability`  
**Author:** Architect agent  
**Related design docs:** `issue-210-dashboard-architecture-refactor.md`, `issue-210-ui-architecture-audit.md`  
**Reviewed by:** mobile-ui agent — no visual changes planned; UI layout is preserved as-is (see §7)

---

## 1. Problem Statement

`src/hooks/usePaymentDetails.ts` (`loadData` callback, lines ~160–240) contains complex
multi-repository orchestration logic that belongs in the **Application layer**, not the Hook
(View-Model) layer. Specifically:

| Violation | Location |
|-----------|----------|
| Multi-repo fan-out (`paymentRepo`, `invoiceRepo`, `projectRepo`) inside a React hook | `loadData` |
| Business rule: synthetic-row construction (building a virtual `Payment` from an `Invoice`) | `loadData` |
| Three distinct entry-path branches (invoice-only, paymentId, syntheticRow) | `loadData` |
| `DI container.resolve()` calls for three repositories inside `useMemo` | Hook top-level |

The hook should be a **thin View-Model**: it owns React state, navigation, modal toggles and
action handlers — but it must **delegate data loading** to a use case.

---

## 2. New Abstraction: `GetPaymentDetailsUseCase`

### 2.1 File location

```
src/application/usecases/payment/GetPaymentDetailsUseCase.ts
```

Follows the existing naming and path convention (see `MarkPaymentAsPaidUseCase.ts`,
`RecordPaymentUseCase.ts`, etc.).

### 2.2 Entry-point variants

The screen can be opened in three distinct ways. The use case encapsulates all three:

| Variant | Trigger | Input discriminant |
|---------|---------|-------------------|
| **Invoice-entry** | `TimelineInvoiceCard` tap — no payment exists yet | `{ invoiceId: string }` |
| **Payment-entry** | Normal payment row tap | `{ paymentId: string }` |
| **Synthetic row** | Pre-populated `Payment` passed as route param | `{ syntheticRow: Payment }` |

### 2.3 Input type

```typescript
// Union discriminated by which identifier is provided
export type GetPaymentDetailsInput =
  | { paymentId: string; invoiceId?: never; syntheticRow?: never }
  | { invoiceId: string; paymentId?: never; syntheticRow?: never }
  | { syntheticRow: Payment; paymentId?: never; invoiceId?: never };
```

### 2.4 Output DTO

```typescript
export interface PaymentDetailsDTO {
  /** The resolved payment (real or synthetic). */
  payment: Payment;
  /** The linked invoice, if any. */
  invoice: Invoice | null;
  /** Other settled/pending payments sharing the same invoiceId. */
  linkedPayments: Payment[];
  /** The linked project, if any. */
  project: Project | null;
  /** True when payment was synthesised from an invoice (no real payment row). */
  isSyntheticRow: boolean;
}
```

> **Why a flat DTO instead of nested objects?**  
> The View-Model derives several presentation values (`totalSettled`, `remainingBalance`,
> `canRecordPayment`) from these fields. A flat, co-located DTO keeps derivation simple and
> avoids nested property chains inside the hook.

### 2.5 Class interface

```typescript
export class GetPaymentDetailsUseCase {
  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly invoiceRepo: InvoiceRepository,
    private readonly projectRepo: ProjectRepository,
  ) {}

  async execute(input: GetPaymentDetailsInput): Promise<PaymentDetailsDTO>;
}
```

### 2.6 Internal orchestration logic (migrated from `loadData`)

The three branches from `loadData` map cleanly to the three input variants:

#### Branch A — Invoice-entry (`{ invoiceId }`)
1. `invoiceRepo.getInvoice(invoiceId)` + `paymentRepo.findByInvoice(invoiceId)` in parallel.
2. Calculate `outstanding = invoice.total − Σ settled payments`.
3. Construct synthetic `Payment` from `Invoice` fields (same mapping as today).
4. If `invoice.projectId` present, `projectRepo.findById(projectId)`.
5. Return DTO with `isSyntheticRow: true`.

#### Branch B — Payment-entry (`{ paymentId }`)
1. `paymentRepo.findById(paymentId)`.
2. If payment has `projectId`, `projectRepo.findById(projectId)`.
3. If payment has `invoiceId`, `invoiceRepo.getInvoice(invoiceId)` + `paymentRepo.findByInvoice(invoiceId)` in parallel.
4. Return DTO with `isSyntheticRow: false`.

#### Branch C — Synthetic row (`{ syntheticRow }`)
1. No paymentRepo call needed — `payment = syntheticRow`.
2. If `syntheticRow.invoiceId` present → fetch invoice + linkedPayments.
3. If invoice has `projectId` → fetch project.
4. Return DTO with `isSyntheticRow: true` (detected by `id.startsWith('invoice-payable:')`).

---

## 3. Updated `usePaymentDetails` Hook

### 3.1 What moves OUT of the hook

| Removed from hook | Now lives in |
|-------------------|-------------|
| `container.resolve<PaymentRepository>(...)` | `GetPaymentDetailsUseCase` constructor |
| `container.resolve<InvoiceRepository>(...)` | `GetPaymentDetailsUseCase` constructor |
| `container.resolve<ProjectRepository>(...)` | `GetPaymentDetailsUseCase` constructor |
| Entire `loadData` multi-branch async function | `GetPaymentDetailsUseCase.execute()` |
| `isSyntheticRow` derivation logic | `GetPaymentDetailsUseCase` returns it in DTO |

### 3.2 What stays IN the hook

| Retained in hook | Rationale |
|-----------------|-----------|
| React state (`payment`, `invoice`, `project`, …) | React state management is a UI concern |
| Modal toggles (`projectPickerVisible`, `partialModalVisible`, …) | UI state |
| Action handlers (`handleMarkAsPaid`, `handleSelectProject`, …) | Orchestrate other use cases |
| Derived presentation values (`totalSettled`, `canRecordPayment`, …) | Derived from DTO, used only by UI |
| `useNavigation`, `useRoute` | Navigation is React Native / UI concern |
| `useQueryClient` + cache invalidation calls | Cache invalidation is a hook-layer concern |

### 3.3 Revised DI wiring in the hook

```typescript
// BEFORE (in hook):
const paymentRepo = useMemo(() => container.resolve<PaymentRepository>(...), []);
const invoiceRepo = useMemo(() => container.resolve<InvoiceRepository>(...), []);
const projectRepo = useMemo(() => container.resolve<ProjectRepository>(...), []);

// AFTER (in hook):
const getDetailsUc = useMemo(
  () => new GetPaymentDetailsUseCase(
    container.resolve<PaymentRepository>('PaymentRepository' as any),
    container.resolve<InvoiceRepository>('InvoiceRepository' as any),
    container.resolve<ProjectRepository>('ProjectRepository' as any),
  ),
  [],
);
```

The three individual `useMemo` repo resolutions collapse into one use-case instantiation.
Individual repos (`invoiceRepo`, `paymentRepo`) are still needed in the hook for the **action**
use cases (`markPaidUc`, `recordPaymentUc`, etc.) — those are not moving in this ticket.

### 3.4 Revised `loadData` in the hook

```typescript
const loadData = useCallback(async () => {
  setLoading(true);
  try {
    const input = resolveInput({ paymentId, syntheticRow, invoiceId: invoiceIdParam });
    const dto = await getDetailsUc.execute(input);

    setPayment(dto.payment);
    setInvoice(dto.invoice);
    setLinkedPayments(dto.linkedPayments);
    setProject(dto.project);
    // isSyntheticRow derived from dto — can also be stored if needed for action logic
  } catch (err) {
    // existing error handling unchanged
  } finally {
    setLoading(false);
  }
}, [getDetailsUc, paymentId, syntheticRow, invoiceIdParam]);
```

A tiny private helper resolves the discriminated union:

```typescript
function resolveInput(params: {
  paymentId?: string;
  syntheticRow?: Payment;
  invoiceId?: string;
}): GetPaymentDetailsInput {
  if (params.syntheticRow) return { syntheticRow: params.syntheticRow };
  if (params.paymentId)    return { paymentId: params.paymentId };
  if (params.invoiceId)    return { invoiceId: params.invoiceId };
  throw new Error('GetPaymentDetailsUseCase: no valid input provided');
}
```

---

## 4. Dependency Flow (After Refactor)

```
PaymentDetails (UI — unchanged)
  └── usePaymentDetails (View-Model Hook)
        ├── GetPaymentDetailsUseCase          ← NEW Application layer use case
        │     ├── PaymentRepository           (Infrastructure)
        │     ├── InvoiceRepository           (Infrastructure)
        │     └── ProjectRepository           (Infrastructure)
        ├── MarkPaymentAsPaidUseCase          (existing)
        ├── RecordPaymentUseCase              (existing)
        ├── LinkPaymentToProjectUseCase       (existing)
        └── LinkInvoiceToProjectUseCase       (existing)
```

---

## 5. File Change Inventory

| File | Change Type | Summary |
|------|-------------|---------|
| `src/application/usecases/payment/GetPaymentDetailsUseCase.ts` | **New file** | Use case encapsulating all three entry-path branches |
| `src/hooks/usePaymentDetails.ts` | **Refactor** | Remove per-repo DI + `loadData` logic; inject `GetPaymentDetailsUseCase`; call `execute()` |

No changes to `src/pages/payments/PaymentDetails.tsx` — the UI is untouched.

---

## 6. TDD Acceptance Criteria

### 6.1 `GetPaymentDetailsUseCase` unit tests
**File:** `__tests__/unit/usecases/GetPaymentDetailsUseCase.test.ts`

- [ ] **Invoice-entry path:** Given `{ invoiceId }`, resolves invoice, builds synthetic payment (correct `id` prefix, `amount` = outstanding, `contractorName` from `issuerName`), fetches project via `invoice.projectId`, returns `isSyntheticRow: true`.
- [ ] **Invoice-entry path — no project:** Given invoice with `projectId = undefined`, returns `project: null`.
- [ ] **Payment-entry path:** Given `{ paymentId }`, resolves payment, fetches invoice and linkedPayments in parallel, fetches project, returns `isSyntheticRow: false`.
- [ ] **Payment-entry path — payment not found:** Throws or returns gracefully (TBD — see open question §8.1).
- [ ] **Synthetic-row path:** Given `{ syntheticRow }`, skips paymentRepo fetch, fetches invoice and project, returns `isSyntheticRow: true`.
- [ ] **Synthetic-row — no invoiceId:** Returns `invoice: null`, `linkedPayments: []`, `project: null`.
- [ ] All three paths call repos with correct arguments and return correctly structured DTO.

### 6.2 `usePaymentDetails` hook tests (updated)
**File:** `__tests__/unit/hooks/usePaymentDetails.test.ts` (existing, to be updated)

- [ ] `loadData` calls `getDetailsUc.execute()` with correct discriminated input.
- [ ] State is populated from the returned DTO.
- [ ] Existing action-handler tests (markAsPaid, partialPayment, linkProject) remain passing unchanged.

---

## 7. UI Design Constraints (mobile-ui agent alignment)

Confirmed **non-negotiable** UI constraints — this refactor is purely internal and preserves:
- All `PaymentDetails.tsx` JSX layout, Tailwind/NativeWind class names, and modal UX.
- No prop interface changes on `PaymentDetails` component.
- No visual regressions on Payment header, Amount/Status card, or linked Project row.

The `mobile-ui` agent has reviewed and confirmed: **zero visual changes are required or expected.**

---

## 8. Open Questions

8.1 **Error handling contract:** Should `execute()` throw when `paymentId` resolves to `null`,
or return `null` as the payment in the DTO? Current hook behaviour is `setPayment(null)` (no throw).
Recommendation: return `payment: null` in the DTO and let the hook render the "not found" state —
consistent with current UX.

8.2 **Synthetic payment type-safety:** The synthetic `Payment` construction today uses
`as unknown as Payment` to bridge mismatched field names (e.g., `issueDate` vs `dateIssued`).
The use case should document this cast and ideally consolidate the field mapping into a typed
factory function — but that is a separate clean-up ticket.

---

## 9. Handoff

> **Label:** Start TDD  
> **Agent:** developer  
> **Prompt:** "Plan approved. Write failing tests for `GetPaymentDetailsUseCase` per §6.1 of `design/issue-210-get-payment-details-usecase.md`, then implement the use case and update `usePaymentDetails` per §3."
