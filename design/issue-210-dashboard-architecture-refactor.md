# Design: Issue #210 — Dashboard Architecture Refactor (Clean Architecture)

**Date:** 2026-04-21  
**Branch:** `issue-210-refactor-observability`  
**Author:** Architect agent  
**Reviewed by:** mobile-ui agent (UI layout preserved — see §6)  
**Updated:** Consolidated hooks per PR review feedback.

---

## 1. Summary

`src/pages/dashboard/index.tsx` violates Clean Architecture by importing and instantiating
infrastructure adapters directly inside the UI component, and managing complex presentation state. 

To address the concern of having too many custom hooks scattered in the component, we are adopting
a View-Model (or Facade Hook) pattern. **A single hook `useDashboard()` will encapsulate all data-fetching
and action-orchestration logic**, meaning the Dashboard UI component only observes one unified source
of truth and delegates all actions to it.

**No visual changes are planned.** Layout, Tailwind tokens, icon sizes, and modal UX are
preserved exactly as-is.

---

## 2. Problem Statement

### 2.1 Violations found in `src/pages/dashboard/index.tsx`

| Line(s) | Violation | Category |
|---------|-----------|----------|
| `import { MobileOcrAdapter }`... | Infrastructure adapters imported in UI | ❌ Layer breach |
| `import { InvoiceNormalizer }` | Application service imported in UI | ❌ Layer breach |
| `import { GROQ_API_KEY } from '@env'` | Env secret access in UI layer | ❌ Layer breach |
| `useMemo(() => new ...)` x 5 | Service/Infra instantiation in UI | ❌ Layer breach |
| `useProjectsOverview()` + `showXxx` states | Mixing data queries with ui-action state | ⚠️ Poor cohesion |
| `require('../tasks/TaskScreen')` | Dynamic `require()` inside JSX IIFE | ⚠️ Anti-pattern |
| `createKey` + `setCreateKey` | Unmount-remount key trick in UI | ⚠️ Side-effect logic |

### 2.2 What is acceptable in the UI layer

| Logic | Verdict |
|-------|---------|
| `quickActions` static config array | ✅ Presentation config |
| Loading / error / empty state rendering | ✅ Pure presentation |
| Conditional modal JSX based on props | ✅ Presentation binding |

---

## 3. Target Architecture (MVVM-style Hook)

```
DashboardScreen (UI — completely "dumb" presentation)
  └── useDashboard (View-Model Hook — facade for data & actions)
        ├── useNavigation (React Navigation)
        ├── useProjectsOverview (Data fetching hook — hidden from UI)
        └── [Adapters created here]:
              MobileOcrAdapter · InvoiceNormalizer · PdfThumbnailConverter
              LlmQuotationParser · LlmReceiptParser
```

### 3.1 Dependency flow (Clean Architecture)

```
UI Layer (DashboardScreen)
  ↓  consumes / delegates to
Hook Layer (useDashboard)
  ↓  consumes queries (useProjectsOverview) / invokes actions
Application Layer (InvoiceNormalizer, use cases)
  ↓  delegates to
Infrastructure Layer (MobileOcrAdapter, PdfThumbnailConverter, LlmXxxParser)
```

---

## 4. New Abstraction: `useDashboard`

### 4.1 File location

`src/pages/dashboard/hooks/useDashboard.ts` (or `src/hooks/useDashboard.ts` if preferred)

### 4.2 Responsibility

Acts as the single View-Model facade for the Dashboard. 
1. **Data:** Calls `useProjectsOverview` internally and passes the `overviews`, `isLoading`, `error`, and derived `hasProjects` downwards.
2. **State:** Owns all `showXxx` modal toggles.
3. **Infrastructure:** Instantiates and holds all `MobileOcrAdapter`, `InvoiceNormalizer`, etc., abstracting this wiring away from the View.

### 4.3 Interface (TypeScript)

```typescript
// src/hooks/useDashboard.ts
import { ProjectOverview } from './useProjectsOverview';

export interface DashboardViewModel {
  // Data State
  overviews?: ProjectOverview[];
  isLoading: boolean;
  error: Error | null;
  hasProjects: boolean;

  // Modal / UI State
  showQuickActions: boolean;
  showSnapReceipt: boolean;
  showAddInvoice: boolean;
  showAdHocTask: boolean;
  showQuotation: boolean;
  createKey: number;

  // Infrastructure Services
  invoiceOcrAdapter: MobileOcrAdapter;
  invoiceNormalizer: InvoiceNormalizer;
  invoicePdfConverter: PdfThumbnailConverter;
  quotationParser: IQuotationParsingStrategy | undefined;
  receiptParser: IReceiptParsingStrategy | undefined;

  // Operations
  openQuickActions: () => void;
  closeQuickActions: () => void;
  handleQuickAction: (actionId: string) => void;
  closeSnapReceipt: () => void;
  closeAddInvoice: () => void;
  closeAdHocTask: () => void;
  closeQuotation: () => void;
  onManualEntry: () => void;
  navigateToProject: (projectId: string) => void;
}

export function useDashboard(): DashboardViewModel;
```

---

## 5. Changes to `DashboardScreen`

### 5.1 Imports completely cleaned up

```typescript
// DELETE ALL OF THESE from src/pages/dashboard/index.tsx:
import { useProjectsOverview } from '../../hooks/useProjectsOverview'; // Now hidden!
import { MobileOcrAdapter } from '../../infrastructure/ocr/MobileOcrAdapter';
import { InvoiceNormalizer } from '../../application/ai/InvoiceNormalizer';
import { PdfThumbnailConverter } from '../../infrastructure/files/PdfThumbnailConverter';
import { LlmQuotationParser } from '../../infrastructure/ai/LlmQuotationParser';
import { LlmReceiptParser } from '../../infrastructure/ai/LlmReceiptParser';
import { GROQ_API_KEY } from '@env';
import { useMemo, useState } from 'react'; // Unused
```

### 5.2 Component body changes

**Before** (15+ lines of data + state + useMemo):
```typescript
const { data: overviews, isLoading, error } = useProjectsOverview();
const navigation = useNavigation<DashboardNavigationProp>();
const [createKey, setCreateKey] = useState(0);
/* ... more states & adapter wiring ... */
const handleQuickAction = (actionId: string) => { ... };
const hasProjects = (overviews?.length ?? 0) > 0;
```

**After** (1 single line):
```typescript
const vm = useDashboard();
```

All JSX references change to use the View-Model prefix `vm.`:
- `isLoading` → `vm.isLoading`
- `hasProjects` → `vm.hasProjects`
- `showQuickActions` → `vm.showQuickActions`
- `setShowQuickActions(false)` → `vm.closeQuickActions()`
- `handleQuickAction(id)` → `vm.handleQuickAction(id)`
- All adapter props pass through `vm.invoiceOcrAdapter`, etc.

### 5.3 Fix dynamic `require()` anti-pattern

Replaces the inline JSX `require()` with a top-level static import:
```tsx
import TaskScreen from '../tasks/TaskScreen';

// inside render:
{vm.showAdHocTask && (
  <TaskScreen onClose={vm.closeAdHocTask} />
)}
```

---

## 6. UI Design Constraints (mobile-ui agent review)

Confirmed **non-negotiable** UI constraints (from `issue-164-dashboard-ui-refined.md`):
- Three-zone card layout, Quick Actions modal styling, and animations are strictly preserved.
- `ManualProjectEntry` with its remount key trick is supported.

---

## 7. File Change Inventory

| File | Change Type | Summary |
|------|-------------|---------|
| `src/hooks/useDashboard.ts` | **New file** | Facade View-Model encapsulating data (`useProjectsOverview`), modal state, infra logic |
| `src/pages/dashboard/index.tsx` | **Refactor** | UI now consumes a single `useDashboard()` hook, deleting 6 infrastructure imports |

---

## 8. TDD Acceptance Criteria

### 8.1 `useDashboard` unit tests (`__tests__/unit/hooks/useDashboard.test.ts`)

- [ ] Returns structured data mapped from `useProjectsOverview` mock (returns `isLoading`, `hasProjects`, `overviews`).
- [ ] `openQuickActions()` / `closeQuickActions()` toggles modal state.
- [ ] `handleQuickAction('1')` closes quick actions modal and opens `snapReceipt`.
- [ ] Correctly sets appropriate `showXxx` true based on Quick Action ID.
- [ ] Infrastructure adapters are populated and stable references.
- [ ] `navigateToProject('id')` correctly calls React Navigation dispatcher.

### 8.2 `DashboardScreen` integration test (`__tests__/unit/pages/DashboardScreen.test.tsx`)

- [ ] UI renders completely mock-driven from `useDashboard()` hook injected values.
- [ ] Zero `infrastructure/` or `application/` layer imports exist in the file.
