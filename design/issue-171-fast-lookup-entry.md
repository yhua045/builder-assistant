# Design: Issue #171 — Fast Lookup-Value Entry (Contractor / Builder License Lookup)

**Branch**: `feature/issue-171-blocker`  
**Date**: 2026-03-24  
**Status**: Draft — awaiting LGTB approval

---

## 1. User Story

**As a** project manager entering a new task or quotation,  
**I want to** quickly add or find a contractor/subcontractor without leaving the form,  
**so that** data entry is faster, less error-prone, and lookup values are always up to date.

---

## 2. Scope

### In scope
- **Manual quick-create**: Inline `+ Add` affordance in contractor selectors → compact modal (name, trade, licenseNumber, phone).
- **LookupProvider interface**: Pluggable domain port so a future registry adapter can slot in without UI changes.
- **NullLookupProvider stub**: Ships as the default implementation — renders "no external lookup configured" gracefully; external API integration is a separate follow-up.
- **CSV bulk import**: Admin-only utility to seed `contacts` from CSV (rows: name, trade, licenseNumber, phone). Validated with dry-run preview, errors reported by row.
- **Suggestion ranking**: Frequently-used contractors (by `usageCount`) surfaced first in selectors.
- **Feature flags**: External lookup and CSV import gated behind `FeatureFlags.externalLookup` and `FeatureFlags.csvImport`.
- **Telemetry hooks**: Named events emitted via a minimal `analytics` shim at key actions (quick-add saved, lookup triggered, CSV imported).

### Out of scope (separate follow-ups)
- Concrete builder-registry (VBA, NSW Fair Trading, etc.) API integration.
- Bulk edit / delete of contacts.
- Online sync of contacts to a backend.

---

## 3. Acceptance Criteria

| # | Criterion |
|---|-----------|
| AC-1 | `ContactSelector` and `SubcontractorPickerModal` both show an inline `+ Add` affordance when user has typed a string that matches no existing contact. |
| AC-2 | Tapping `+ Add` opens `QuickAddContractorModal`; the name field is pre-filled with the search query. |
| AC-3 | Saving the modal creates a Contact via `QuickAddContactUseCase`, persists it via `DrizzleContactRepository`, and immediately makes it selectable in the originating selector (no navigation or page reload). |
| AC-4 | `LookupProvider` interface is defined in `src/domain/services`; a `NullLookupProvider` is registered by default in DI. |
| AC-5 | When `FeatureFlags.externalLookup` is `true`, a "Lookup by license" option appears in `QuickAddContractorModal`; the result can be previewed and imported in one action; if no result / timeout, the modal remains in manual-entry mode with a friendly error message. |
| AC-6 | When `FeatureFlags.csvImport` is `true`, admin users see a "Import CSV" action in the Contacts section; `CsvImportModal` accepts a CSV file, shows a dry-run preview with valid rows and row-level errors, and on confirm saves valid rows to `ContactRepository`. |
| AC-7 | Contractor selectors rank contacts by `usageCount DESC` (most-used first), then alphabetically. `usageCount` increments each time a contact is selected via the selector. |
| AC-8 | All new fields (`licenseNumber`, `usageCount`) are schema-migrated via Drizzle; column additions are backward-compatible (nullable / defaulted). |
| AC-9 | Unit tests pass for `QuickAddContactUseCase`, `LookupProviderSearchUseCase`, `ImportContractorsFromCsvUseCase`, and `QuickAddContractorModal`. |
| AC-10 | Integration test verifies: save new contact via use case → `findById` returns it immediately. |

---

## 4. Domain Model Changes

### 4.1 `Contact` entity — new fields
```ts
// src/domain/entities/Contact.ts
licenseNumber?: string;   // builder/contractor registration number (optional)
usageCount?: number;      // times selected across all projects (default 0)
```

### 4.2 `ContactRepository` interface — new methods
```ts
incrementUsageCount(id: string): Promise<void>;
findMostUsed(limit?: number): Promise<Contact[]>; // ordered by usageCount DESC
```

### 4.3 New domain port: `ILookupProvider`
```ts
// src/domain/services/ILookupProvider.ts
export interface LookupResult {
  licenseNumber: string;
  name: string;
  trade?: string;
  phone?: string;
  address?: string;
  source: string;               // e.g. 'VBA' | 'NSW_FAIR_TRADING'
}

export interface ILookupProvider {
  search(query: string): Promise<LookupResult[]>;
  isAvailable(): boolean;
}
```

---

## 5. Application Layer — New Use Cases

| Use Case | Inputs | Outputs | Validation |
|---|---|---|---|
| `QuickAddContactUseCase` | `{name, trade?, licenseNumber?, phone?, roles?}` | saved `Contact` | name non-empty; licenseNumber format if present |
| `LookupProviderSearchUseCase` | `{query, timeoutMs?}` | `LookupResult[]` | delegates to `ILookupProvider`; throws `LookupUnavailableError` if `!isAvailable()` |
| `ImportContractorsFromCsvUseCase` | `csvText: string` | `ImportSummary {totalRows, imported, errors[]}` | validates required column `name`; skips blank rows; reports row-level errors |
| `GetSuggestedContractorsUseCase` | `{limit?, roleFilter?}` | `Contact[]` | delegates to `findMostUsed`; falls back to `findAll` sorted alpha |

---

## 6. Infrastructure Layer Changes

### 6.1 Drizzle schema — `contacts` table additions
```ts
// src/infrastructure/database/schema.ts
licenseNumber: text('license_number'),
usageCount: integer('usage_count').default(0),
```
Migration generated by `npm run db:generate` and applied automatically on next app start.

### 6.2 `DrizzleContactRepository` — new methods
Implement `incrementUsageCount` (UPDATE … SET usage_count = usage_count + 1) and `findMostUsed` (SELECT … ORDER BY usage_count DESC LIMIT ?) using Drizzle query builder.

### 6.3 `NullLookupProvider`
```ts
// src/infrastructure/lookup/NullLookupProvider.ts
export class NullLookupProvider implements ILookupProvider {
  isAvailable() { return false; }
  async search(_query: string): Promise<LookupResult[]> { return []; }
}
```
Registered in `registerServices.ts` as `'LookupProvider'`.

### 6.4 `FeatureFlags`
```ts
// src/infrastructure/config/featureFlags.ts
export const FeatureFlags = {
  externalLookup: false,   // flip to true when a real LookupProvider is wired
  csvImport: false,        // flip to true to enable admin CSV import
} as const;
```

---

## 7. UI / Hooks Layer

### 7.1 `useQuickLookup` hook — `src/hooks/useQuickLookup.ts`
Responsibilities:
- Exposes `suggestedContacts` (top-N by usageCount).
- Exposes `quickAdd(fields)` — calls `QuickAddContactUseCase`, invalidates `queryKeys.contacts()`, returns the new `Contact`.
- Exposes `lookupByLicense(query)` — calls `LookupProviderSearchUseCase`; gated by `FeatureFlags.externalLookup`.
- Exposes `selectContact(id)` — calls `incrementUsageCount` then invokes caller's `onChange`.

### 7.2 `QuickAddContractorModal` — `src/components/inputs/QuickAddContractorModal.tsx`
- Fields: `name` (required), `trade` (optional), `licenseNumber` (optional), `phone` (optional).
- Actions: **Save** (validate → `quickAdd`) | **Cancel**.
- When `FeatureFlags.externalLookup` is `true`: shows a "Lookup by license" button → inline results list → "Import" each result. On error: toast/inline message, fallback to manual entry.
- `testID` props on all interactive elements.

### 7.3 `ContactSelector` — extend existing `src/components/inputs/ContactSelector.tsx`
- Add `onQuickAdd?: (initialName: string) => void` prop.
- When search returns no results **and** `query.length > 0`, show `+ Add "{query}"` entry at the bottom of the dropdown.
- Tapping it opens `QuickAddContractorModal` with `initialName = query`.
- After save, call `onChange(newContact.id)` and dismiss dropdown.

### 7.4 `SubcontractorPickerModal` — extend `src/components/tasks/SubcontractorPickerModal.tsx`
- Add a `+ Add Subcontractor` button at the top-right of the modal header.
- Renders `QuickAddContractorModal` as a nested modal; on save, re-queries the list and auto-selects the new contact.

### 7.5 `CsvImportModal` — `src/components/admin/CsvImportModal.tsx` (feature-flagged)
- Accepts `.csv` via `IFilePickerAdapter`.
- Shows dry-run table: ✅ valid rows, ❌ rows with error reason.
- "Import N contacts" button commits valid rows; shows final summary.
- Gated: rendered only when `FeatureFlags.csvImport === true`.

---

## 8. File Manifest

### New files
| Path | Description |
|---|---|
| `src/domain/services/ILookupProvider.ts` | Domain port interface |
| `src/application/usecases/contact/QuickAddContactUseCase.ts` | Quick-add use case |
| `src/application/usecases/contact/LookupProviderSearchUseCase.ts` | External lookup use case |
| `src/application/usecases/contact/ImportContractorsFromCsvUseCase.ts` | CSV import use case |
| `src/application/usecases/contact/GetSuggestedContractorsUseCase.ts` | Suggestion ranking use case |
| `src/infrastructure/lookup/NullLookupProvider.ts` | Default no-op provider |
| `src/infrastructure/config/featureFlags.ts` | Feature flag constants |
| `src/hooks/useQuickLookup.ts` | UI-facing hook |
| `src/components/inputs/QuickAddContractorModal.tsx` | Compact quick-add modal |
| `src/components/admin/CsvImportModal.tsx` | Admin CSV import modal |
| `__tests__/unit/QuickAddContactUseCase.test.ts` | Unit test |
| `__tests__/unit/LookupProviderSearchUseCase.test.ts` | Unit test |
| `__tests__/unit/ImportContractorsFromCsvUseCase.test.ts` | Unit test |
| `__tests__/unit/QuickAddContractorModal.test.tsx` | Component unit test |
| `__tests__/integration/DrizzleContactRepository.quickadd.integration.test.ts` | Integration test |

### Modified files
| Path | Change |
|---|---|
| `src/domain/entities/Contact.ts` | + `licenseNumber`, `usageCount` fields |
| `src/domain/repositories/ContactRepository.ts` | + `incrementUsageCount`, `findMostUsed` methods |
| `src/infrastructure/database/schema.ts` | + `license_number`, `usage_count` columns on `contacts` |
| `src/infrastructure/repositories/DrizzleContactRepository.ts` | Map new fields; implement new methods |
| `src/infrastructure/di/registerServices.ts` | Register `LookupProvider` |
| `src/components/inputs/ContactSelector.tsx` | + `+ Add` affordance |
| `src/components/tasks/SubcontractorPickerModal.tsx` | + `+ Add Subcontractor` button |

---

## 9. Test Acceptance Matrix

| Test file | What it verifies | Type |
|---|---|---|
| `QuickAddContactUseCase.test.ts` | Validates required fields; calls `repo.save`; returns saved Contact | Unit |
| `LookupProviderSearchUseCase.test.ts` | Provider unavailable → throws; available → returns results; timeout → error | Unit |
| `ImportContractorsFromCsvUseCase.test.ts` | Valid rows saved; invalid rows reported; empty CSV handled | Unit |
| `QuickAddContractorModal.test.tsx` | Renders fields; Save calls quickAdd; Cancel dismisses; feature-flag lookup toggle | Unit |
| `DrizzleContactRepository.quickadd.integration.test.ts` | save new contact → findById returns it; incrementUsageCount; findMostUsed ordering | Integration |

---

## 10. Effort Estimate

| Layer | Tasks | Effort |
|---|---|---|
| Domain | Entity + repository extension + ILookupProvider | XS |
| Application | 4 use cases | S |
| Infrastructure | Schema migration + DrizzleContactRepository extension + NullLookupProvider + FeatureFlags | S |
| UI / Hooks | useQuickLookup + QuickAddContractorModal + ContactSelector extension + SubcontractorPickerModal extension + CsvImportModal | M |
| Tests | 4 unit + 1 integration | S |
| **Total** | | **Small–Medium** |

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `DrizzleContactRepository` currently uses raw `executeSql` (CLAUDE.md violation) | Extend with Drizzle query builder for new methods; note full rewrite as tech-debt follow-up |
| External registry APIs vary significantly by region | Ship only `NullLookupProvider` now; interface is pluggable; real adapters are follow-ups |
| CSV format ambiguity | Hardcode expected columns (`name`, `trade`, `licenseNumber`, `phone`); reject files with missing `name` header; report all other issues at row level |
| Schema migration on existing devices | Both new columns are nullable/default — no data loss; Drizzle auto-migration is safe |
