# Design: Vertical-Slice (Feature-Module) Architecture — Issue #212

**Date:** 2026-04-28  
**Issue:** [#212 — Adopt Vertical-Slice (Modular) Architecture](https://github.com/yhua045/builder-assistant/issues/212)  
**Type:** Structural Refactor (no runtime behaviour changes)

---

## 1. Goal & Motivation

Move from the current **horizontal layered layout** to a **vertical-slice (feature-module)** architecture. Each feature becomes a self-contained module owning its domain port, use cases, infrastructure adapters, UI components, hooks, and tests.

The existing Clean Architecture dependency direction is **preserved** inside each module:

```
UI (ui/) → Hooks (hooks/) → Use Cases (application/) → Domain port (domain/)
                                          ↓
                              Infrastructure (infrastructure/)
```

The `receipts` feature is used as the **pilot module** to validate the pattern before mass migration.

---

## 2. Current (Horizontal) Layout

```
src/
├── domain/
│   ├── entities/          ← shared entity types (Invoice, Payment, Task …)
│   ├── repositories/      ← ALL repo interfaces (ReceiptRepository.ts here)
│   └── services/
├── application/
│   ├── receipt/           ← receipt normalizers & parsers
│   └── usecases/receipt/  ← SnapReceiptUseCase, ProcessReceiptUploadUseCase
├── infrastructure/
│   ├── ai/                ← LlmReceiptParser, TfLiteReceiptNormalizer
│   └── repositories/      ← DrizzleReceiptRepository
├── components/receipts/   ← ReceiptForm.tsx
├── hooks/                 ← useSnapReceipt.ts, useSnapReceiptScreen.ts
├── pages/receipts/        ← SnapReceiptScreen.tsx
└── utils/                 ← normalizedReceiptToFormValues.ts

__tests__/
├── unit/                  ← SnapReceiptUseCase.test.ts, ReceiptFieldParser.test.ts …
└── integration/           ← DrizzleReceiptRepository.integration.test.ts …
```

---

## 3. Target (Vertical-Slice) Layout — `receipts` pilot module

> **Mobile-UI review (2026-04-28):** Differentiate routable screens from their
> sub-components to avoid a flat `ui/` folder becoming unmanageable as the
> feature grows. Use `screens/` for top-level navigable routes and
> `components/` for composable sub-components. Drop the generic `ui/` wrapper
> to keep import paths clean.

```
src/
├── features/
│   └── receipts/
│       ├── domain/
│       │   └── ReceiptRepository.ts
│       ├── application/
│       │   ├── IReceiptNormalizer.ts
│       │   ├── IReceiptParsingStrategy.ts
│       │   ├── DeterministicReceiptNormalizer.ts
│       │   ├── NoOpReceiptNormalizer.ts
│       │   ├── ReceiptFieldParser.ts
│       │   ├── SnapReceiptUseCase.ts
│       │   └── ProcessReceiptUploadUseCase.ts
│       ├── infrastructure/
│       │   ├── DrizzleReceiptRepository.ts
│       │   ├── LlmReceiptParser.ts
│       │   └── TfLiteReceiptNormalizer.ts
│       ├── screens/
│       │   └── SnapReceiptScreen.tsx    ← was src/pages/receipts/
│       ├── components/
│       │   └── ReceiptForm.tsx          ← was src/components/receipts/
│       ├── hooks/
│       │   ├── useSnapReceipt.ts
│       │   └── useSnapReceiptScreen.ts
│       ├── utils/
│       │   └── normalizedReceiptToFormValues.ts
│       ├── tests/
│       │   ├── unit/
│       │   │   ├── SnapReceiptUseCase.test.ts
│       │   │   ├── SnapReceiptUseCase.lineItems.test.ts
│       │   │   ├── screens/
│       │   │   │   └── SnapReceiptScreen.camera.test.tsx
│       │   │   ├── useSnapReceiptScreen.test.ts
│       │   │   ├── DeterministicReceiptNormalizer.test.ts
│       │   │   ├── ReceiptFieldParser.test.ts
│       │   │   ├── ProcessReceiptUploadUseCase.receipt.test.ts
│       │   │   ├── LlmReceiptParser.test.ts
│       │   │   └── normalizedReceiptToFormValues.test.ts
│       │   └── integration/
│       │       ├── DrizzleReceiptRepository.integration.test.ts
│       │       └── SnapReceiptCamera.integration.test.tsx
│       └── index.ts                     ← public barrel export
│
├── domain/                              ← SHARED entities only
│   ├── entities/          (Invoice.ts, Payment.ts, … — unchanged)
│   ├── repositories/      (other repos — unchanged; ReceiptRepository.ts removed)
│   └── services/          (unchanged)
│
├── infrastructure/                      ← SHARED infra only
│   ├── database/          (schema.ts, migrations — unchanged)
│   ├── di/                (container.ts, registerServices — updated)
│   ├── camera/            (unchanged)
│   ├── files/             (unchanged)
│   ├── voice/             (unchanged)
│   └── …                 (other non-receipt adapters unchanged)
│
├── application/                         ← non-receipt use cases / services (unchanged)
├── components/                          ← non-receipt components (unchanged)
├── hooks/                               ← non-receipt hooks (unchanged)
├── pages/                               ← non-receipt screens (unchanged)
└── utils/                               ← non-receipt utils (unchanged)
```

---

## 4. Shared vs. Feature-Owned Boundaries

| Asset | Owner | Rationale |
|---|---|---|
| `domain/entities/Invoice.ts` | **Shared** | Used by invoices, receipts, payments |
| `domain/entities/Payment.ts` | **Shared** | Used by receipts, payments, tasks |
| `domain/repositories/ReceiptRepository.ts` | **Feature** (`receipts/domain/`) | Owned solely by receipts |
| `application/services/IOcrAdapter.ts` | **Shared** | Used by invoices and receipts |
| `infrastructure/database/schema.ts` | **Shared** | Single Drizzle schema for all modules |
| `infrastructure/di/container.ts` | **Shared** | Global DI container (updated registrations) |
| `infrastructure/ai/LlmReceiptParser.ts` | **Feature** (`receipts/infrastructure/`) | Receipt-specific |
| `infrastructure/ai/TfLiteReceiptNormalizer.ts` | **Feature** (`receipts/infrastructure/`) | Receipt-specific |

---

## 5. Barrel Export Design (`src/features/receipts/index.ts`)

The barrel exports only the **public API** needed by other modules (e.g., navigation, DI wiring):

```typescript
// Public screen
export { SnapReceiptScreen } from './screens/SnapReceiptScreen';

// Public hooks (if consumed by shared screens such as Dashboard)
export { useSnapReceipt } from './hooks/useSnapReceipt';
export { useSnapReceiptScreen } from './hooks/useSnapReceiptScreen';

// Public types needed by callers
export type { SnapReceiptDTO } from './application/SnapReceiptUseCase';
export type { NormalizedReceipt } from './application/IReceiptNormalizer';
export type { IReceiptParsingStrategy } from './application/IReceiptParsingStrategy';
```

Internal module files (`DrizzleReceiptRepository`, `LlmReceiptParser`, etc.) are **not** re-exported — they are accessed only via the DI container.

---

## 6. Import Path Strategy

### 6.1 No new `tsconfig.json` path aliases required

Relative imports within the module are used. Cross-module consumption via barrel:

```typescript
// ✅ Within receipts module (relative)
import { ReceiptRepository } from '../domain/ReceiptRepository';

// ✅ Cross-module usage (barrel)
import { SnapReceiptScreen } from '@/features/receipts';
// or until path aliases are set up:
import { SnapReceiptScreen } from '../../features/receipts';
```

### 6.2 TypeScript path alias (optional / Phase 2)

A `@/features/*` alias can be added to `tsconfig.json` and `babel.config.js` after the pilot is validated:

```json
// tsconfig.json
"paths": {
  "@/features/*": ["src/features/*"]
}
```

This is **not required** for the pilot and is deferred to avoid scope creep.

---

## 7. File Migration Map

All moves are **renames only** — no logic changes.

| Source (current) | Destination (new) |
|---|---|
| `src/domain/repositories/ReceiptRepository.ts` | `src/features/receipts/domain/ReceiptRepository.ts` |
| `src/application/receipt/IReceiptNormalizer.ts` | `src/features/receipts/application/IReceiptNormalizer.ts` |
| `src/application/receipt/IReceiptParsingStrategy.ts` | `src/features/receipts/application/IReceiptParsingStrategy.ts` |
| `src/application/receipt/DeterministicReceiptNormalizer.ts` | `src/features/receipts/application/DeterministicReceiptNormalizer.ts` |
| `src/application/receipt/NoOpReceiptNormalizer.ts` | `src/features/receipts/application/NoOpReceiptNormalizer.ts` |
| `src/application/receipt/ReceiptFieldParser.ts` | `src/features/receipts/application/ReceiptFieldParser.ts` |
| `src/application/usecases/receipt/SnapReceiptUseCase.ts` | `src/features/receipts/application/SnapReceiptUseCase.ts` |
| `src/application/usecases/receipt/ProcessReceiptUploadUseCase.ts` | `src/features/receipts/application/ProcessReceiptUploadUseCase.ts` |
| `src/infrastructure/repositories/DrizzleReceiptRepository.ts` | `src/features/receipts/infrastructure/DrizzleReceiptRepository.ts` |
| `src/infrastructure/ai/LlmReceiptParser.ts` | `src/features/receipts/infrastructure/LlmReceiptParser.ts` |
| `src/infrastructure/ai/TfLiteReceiptNormalizer.ts` | `src/features/receipts/infrastructure/TfLiteReceiptNormalizer.ts` |
| `src/components/receipts/ReceiptForm.tsx` | `src/features/receipts/components/ReceiptForm.tsx` |
| `src/pages/receipts/SnapReceiptScreen.tsx` | `src/features/receipts/screens/SnapReceiptScreen.tsx` |
| `src/hooks/useSnapReceipt.ts` | `src/features/receipts/hooks/useSnapReceipt.ts` |
| `src/hooks/useSnapReceiptScreen.ts` | `src/features/receipts/hooks/useSnapReceiptScreen.ts` |
| `src/utils/normalizedReceiptToFormValues.ts` | `src/features/receipts/utils/normalizedReceiptToFormValues.ts` |
| `__tests__/unit/SnapReceiptUseCase.test.ts` | `src/features/receipts/tests/unit/SnapReceiptUseCase.test.ts` |
| `__tests__/unit/SnapReceiptUseCase.lineItems.test.ts` | `src/features/receipts/tests/unit/SnapReceiptUseCase.lineItems.test.ts` |
| `__tests__/unit/SnapReceiptScreen.camera.test.tsx` | `src/features/receipts/tests/unit/screens/SnapReceiptScreen.camera.test.tsx` |
| `__tests__/unit/hooks/useSnapReceiptScreen.test.ts` | `src/features/receipts/tests/unit/useSnapReceiptScreen.test.ts` |
| `__tests__/unit/DeterministicReceiptNormalizer.test.ts` | `src/features/receipts/tests/unit/DeterministicReceiptNormalizer.test.ts` |
| `__tests__/unit/ReceiptFieldParser.test.ts` | `src/features/receipts/tests/unit/ReceiptFieldParser.test.ts` |
| `__tests__/unit/ProcessReceiptUploadUseCase.receipt.test.ts` | `src/features/receipts/tests/unit/ProcessReceiptUploadUseCase.receipt.test.ts` |
| `__tests__/unit/LlmReceiptParser.test.ts` | `src/features/receipts/tests/unit/LlmReceiptParser.test.ts` |
| `__tests__/unit/normalizedReceiptToFormValues.test.ts` | `src/features/receipts/tests/unit/normalizedReceiptToFormValues.test.ts` |
| `__tests__/integration/DrizzleReceiptRepository.integration.test.ts` | `src/features/receipts/tests/integration/DrizzleReceiptRepository.integration.test.ts` |
| `__tests__/integration/SnapReceiptCamera.integration.test.tsx` | `src/features/receipts/tests/integration/SnapReceiptCamera.integration.test.tsx` |

> **Note on test co-location:** Screen-level tests mirror the `screens/` sub-directory
> (`tests/unit/screens/SnapReceiptScreen.camera.test.tsx`). Component tests mirror
> `components/`. Application, infrastructure, hooks, and utils tests sit flat under
> `tests/unit/`.

---

## 8. Import Updates Required After Migration

After moving files, the following import paths must be updated:

### 8.1 Within the receipts feature module
All cross-file imports become relative within `src/features/receipts/`.

### 8.2 External callers that import receipts files
These files import receipts artifacts and must be updated to use the barrel:

| File | Current import | New import |
|---|---|---|
| `src/hooks/useDashboard.ts` | `'../application/receipt/IReceiptParsingStrategy'` | `'../features/receipts'` |
| `src/infrastructure/di/registerServices.ts` | `'../repositories/DrizzleReceiptRepository'` | `'../../features/receipts/infrastructure/DrizzleReceiptRepository'` |
| Navigation entrypoints importing `SnapReceiptScreen` | `'../pages/receipts/SnapReceiptScreen'` | `'../features/receipts'` |

### 8.3 Test import path updates
All receipt test files use paths like `../../src/application/usecases/receipt/...`. After migration, paths become relative within the module (e.g., `../../application/SnapReceiptUseCase`).

---

## 9. DI Registration Update

`src/infrastructure/di/registerServices.ts` registers `DrizzleReceiptRepository` as `'ReceiptRepository'`. After migration, the import path changes but the registration token and runtime behaviour remain identical:

```typescript
// Before
import { DrizzleReceiptRepository } from '../repositories/DrizzleReceiptRepository';

// After
import { DrizzleReceiptRepository } from '../../features/receipts/infrastructure/DrizzleReceiptRepository';
```

No new DI tokens are introduced; the container API is unchanged.

---

## 10. UI Component Design Considerations

_Reviewed with `@mobile-ui` agent — 2026-04-28. Recommendations incorporated._

### Rationale: `screens/` + `components/` instead of `ui/`

The mobile-ui agent recommended dropping the generic `ui/` wrapper in favour of two
purpose-specific directories:

| Directory | Purpose | Contents |
|---|---|---|
| `screens/` | Top-level, **routable** views wired to the navigator | `SnapReceiptScreen.tsx` |
| `components/` | Composable **sub-components** used by screens or other components | `ReceiptForm.tsx` |

This distinction:
- Makes it immediately clear which files are navigation entry-points vs. reusable pieces
- Keeps imports clean (`./screens/SnapReceiptScreen` vs. the opaque `./ui/SnapReceiptScreen`)
- Scales gracefully — additional screens (e.g., `ReceiptDetailScreen`) go to `screens/`; additional form widgets go to `components/`
- Aligns with the standard React Native community convention used across the rest of the codebase (`src/pages/` → feature `screens/`, `src/components/` → feature `components/`)

### 10.1 `SnapReceiptScreen.tsx` → `src/features/receipts/screens/SnapReceiptScreen.tsx`
- **Screen** containing camera/file upload entry points and hosting the `ReceiptForm`
- Uses `useSnapReceiptScreen` hook (MVVM View-Model pattern established in issue #210)
- Props interface is preserved; no visual or layout changes in this refactor
- Navigation registration (in `src/pages/tabs/index.tsx` or equivalent) must update its import to the barrel

### 10.2 `ReceiptForm.tsx` → `src/features/receipts/components/ReceiptForm.tsx`
- Controlled form component; receives `NormalizedReceipt` and callbacks as props
- No visual changes; only import path changes
- Prop interface stability, StyleSheet conventions, and accessibility labels are unchanged

---

## 11. Jest Configuration Update

The Jest preset (`react-native`) discovers tests using the default `testMatch`:  
`["**/__tests__/**/*.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"]`

Since `**/?(*.)+(spec|test).[jt]s?(x)` matches files anywhere in `src/`, no changes to `jest.config.js` are required. Tests inside `src/features/receipts/tests/` are discovered automatically.

---

## 12. `CLAUDE.md` Updates

After the pilot module is validated, `CLAUDE.md` must be updated to reflect:
1. The `src/features/<feature>/` layout as the canonical structure for new features
2. The shared boundary rules (Section 4 above)
3. Migration checklist for adopting an existing horizontal-layer feature

---

## 13. Acceptance Criteria

1. `src/features/receipts/` exists with `domain`, `application`, `infrastructure`, `screens`, `components`, `hooks`, `utils`, `tests` sub-directories.
2. All receipt files have been moved (see Section 7); old paths deleted.
3. All import paths updated; `npx tsc --noEmit` passes with 0 errors.
4. All receipt-specific tests (unit + integration) pass from their new location under `src/features/receipts/tests/`.
5. No other feature's tests regress (full suite green).
6. `src/features/receipts/index.ts` barrel exports the public API.
7. `CLAUDE.md` documents the feature-module conventions and migration path.
8. **No runtime behaviour changes** — existing screens, navigation, and DI wiring function identically.

---

## 14. Out of Scope (This PR)

- Migration of other features (invoices, payments, tasks, etc.)
- Adding `@/features/*` TypeScript path aliases
- Any new functionality or UI changes beyond relocation

---

## 15. Migration Steps (Developer Checklist)

- [ ] Create `src/features/receipts/` directory structure
- [ ] Move domain port: `ReceiptRepository.ts`
- [ ] Move application layer files (normalizers, parsers, use cases)
- [ ] Move infrastructure adapters (`DrizzleReceiptRepository`, LLM/TfLite parsers)
- [ ] Move routable screen (`SnapReceiptScreen`) to `screens/`
- [ ] Move sub-component (`ReceiptForm`) to `components/`
- [ ] Move hooks (`useSnapReceipt`, `useSnapReceiptScreen`)
- [ ] Move utils (`normalizedReceiptToFormValues.ts`)
- [ ] Create `src/features/receipts/index.ts` barrel
- [ ] Update all within-module relative imports
- [ ] Update all external callers (DI, hooks, navigation) to use new paths / barrel
- [ ] Move test files to `src/features/receipts/tests/`
- [ ] Update test import paths (relative within module)
- [ ] Run `npx tsc --noEmit` — 0 errors
- [ ] Run `npm test` — full suite green
- [ ] Update `CLAUDE.md` with feature-module conventions
