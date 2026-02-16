# Builder Assistant - Clean Architecture Guide

## 📋 Overview

This React Native construction project management app implements **Clean Architecture** with Test-Driven Development (TDD). The architecture separates business logic from UI and platform-specific code, ensuring maintainability, testability, and scalability.

**Key Technologies:**
- React Native 0.81.1 + React 19.1.0
- TypeScript 5.8+ (strict mode)
- Drizzle ORM + SQLite (react-native-sqlite-storage)
- Jest for testing
- NativeWind (Tailwind) for styling

## 🏗️ Architecture Structure

```
/builder-assistant
│
├── /android                    # Android-specific code & configuration
├── /ios                       # iOS-specific code & configuration
├── /src                       # Shared application source code
│   ├── /domain                # 🔵 Domain Layer (Business Logic)
│   │   ├── /entities          # Business entities (Project, Invoice, Quotation, etc.)
│   │   ├── /repositories      # Data access interfaces (repository contracts)
│   │   └── /services          # Domain services & validation
│   ├── /application           # 🟢 Application Layer (Use Cases)
│   │   └── /usecases          # Feature-based use cases (project/, invoice/, quotation/)
│   ├── /infrastructure        # 🔴 Infrastructure Layer
│   │   ├── /database          # Drizzle ORM schema, migrations, connection
│   │   └── /repositories      # Drizzle repository implementations
│   ├── /components            # 🟡 UI Components
│   ├── /hooks                 # React hooks (UI-to-application connectors)
│   ├── /pages                 # Screen-level components
│   └── /utils                 # Pure utility functions
├── /assets                    # Static assets (images, fonts)
├── App.tsx                    # Main application entry point
└── package.json               # Dependencies and scripts
```

## 🎯 Architecture Layers
 - framework-agnostic**

#### Entities (`/entities`)
Core business objects with validation and immutable factory patterns:
- `Project.ts` - Status management, budget validation, workflow transitions
- `Invoice.ts` - Line items, totals validation, payment tracking
- `Quotation.ts` - Vendor quotes, expiry dates, line item consistency
- `Payment.ts` - Invoice linkage, settlement tracking
- `Contact.ts` - Roles (owner, contractor, vendor, etc.)
- `Property.ts` - Project site information
- `Document.ts` - File metadata, OCR text, cloud sync status
- `Expense.ts` - Receipt capture, AI validation
- Plus: `Milestone`, `Task`, `Inspection`, `ChangeOrder`, `WorkVariation`

#### Repositories (`/repositories`)
Data access interfaces (contracts only - no implementation):
- `ProjectRepository.ts`, `InvoiceRepository.ts`, `QuotationRepository.ts`
- `PaymentRepository.ts`, `DocumentRepository.ts`, `ContactRepository.ts`
- Each defines CRUD + domain-specific query methods
- implements application-specific business flows**

#### Use Cases (`/usecases`)
Organized by feature domain:
- **project/** - `CreateProjectUseCase`, `ArchiveProjectUseCase`, `UpdateProjectStatusUseCase`, etc.
- **invoice/** - `CreateInvoiceUseCase`, `GetInvoiceByIdUseCase`, `ListInvoicesUseCase`, etc.
- **quotation/** - `CreateQuotationUseCase`, `UpdateQuotationUseCase`, `DeleteQuotationUseCase`, etc.
- **payment/** - `RecordPaymentUseCase`, `ListPaymentsUseCase`, etc.

Each use case:
1. Accepts repository dependencies (via constructor injection)
2. Validates inputs using domain entities
3. Coordinates persistence via repository interfaces
4. Returns domain entities or DTOs

**Key Principles:**
- ✅ Thin orchestration layer (business logic stays in domain)
- ✅ Depends only on domain layer (interfaces)
- ✅ Use cases are pure functions (testable with mocks)
- ✅ No direct database/framework dependenciesly
- ✅ No imports from outer layers (application/infrastructure/UI)I, and external dependencies
- ✅ Contains business rules and validation logic
- ✅ No imports from outer layers

### 🟢 Application Layer (`/src/application`)
**Orchestrates use cases and coordinates between domain and UI**
infrastructure`)pages`, `/src/hooks`)
**React Native presentation layer**

#### Components (`/components`)
Reusable UI building blocks (NativeWind/Tailwind styled):
- `ProjectCard.tsx`, `ProjectList.tsx`
- `InvoiceForm.tsx`, `InvoiceList.tsx`
- `QuickStats.tsx`, `TasksList.tsx`, `TotalExpenseCard.tsx`
- Plus common form inputs, modals, etc.

#### Pages (`/pages`)
Screen-level components:
- `DashboardPage.tsx` - Overview + quick stats
- `ProjectsPage.tsx` - Project list with filters
- `expenses/`, `invoices/`, `payments/` - Feature screens

#### Hooks (`/hooks`)
**UI-to-application connectors** - manage React state + call use cases:
- `useProjects.ts` - Project CRUD + listing
- `useInvoices.ts` - Invoice operations
- `usePayments.ts` - Payment tracking
- Each hook instantiates use cases with repository implementations

**Key Principles:**
- ✅ No business logic (delegates to use cases)
- ✅ Hooks encapsulate state management + use case wiring
- ✅ Components are presentational (receive data via props)
- ✅ NativeWind for consistent styling
┌─────────────────┐
│  UI Component   │  Presentational (NativeWind)
└────────┬────────┘
         │ props/callbacks
         ▼
┌─────────────────┐
│   React Hook    │  State management + use case wiring
└────────┬────────┘
         │ execute()
         ▼
┌─────────────────┐
│    Use Case     │  Application orchestration
└────────┬────────┘
         │ domain methods
         ▼
┌─────────────────┐
│ Domain Entity   │  Business logic & validation
│  (via .create()) │
└────────┬────────┘
         │ persist/query
         ▼
┌─────────────────┐
│   Repository    │  Interface (domain)
│   Interface     │
└────────┬────────┘
         │ implements
         ▼
┌─────────────────┐
│ Drizzle Repo    │  Infrastructure implementation
│ Implementation  │
└────────┬────────┘
         │ SQL via Drizzle ORM
         ▼
┌─────────────────┐
│  SQLite DB      │  On-device persistence
└─────────────────┘
```

**Dependency Rule**: Inner layers know nothing about outer layers
- Domain → No dependencies
- Application → Depends on Domain only
- Infrastructure → Implements Domain interfaces
- UI → Depends on Application + Domain
- ✅ **Drizzle ORM required** - no raw SQLite in app code
- ✅ Implements domain repository interfaces
- ✅ Maps between domain and persistence models
- ✅ Handles platform-specific concerns (file storage, native modules)

### 🟡 UI Layer (`/src (TDD Workflow)

### Test-Driven Development
**Required workflow** (see [CLAUDE.md](CLAUDE.md) - TDD section):
1. **Design first** - Create design doc in `design/` before coding
2. **Write failing tests** - Unit tests with mocks
3. **Implement** - Make tests pass
4. **Integration tests** - Drizzle repos with in-memory SQLite (better-sqlite3)
5. **Refactor** - Keep tests green

### Test Structure
```
__tests__/
├── unit/                          # Fast, isolated tests
│   ├── QuotationEntity.validation.test.ts    # Domain validation
│   ├── CreateQuotationUseCase.test.ts        # Use cases with mocks
│   └── ...
└── integration/                   # Real DB/infrastructure
    ├── DrizzleQuotationRepository.integration.test.ts
    └── ...
```

### Test Patterns

**Domain Entity Tests** - Validation rules:
```typescript
it('throws when total is negative', () => {
  expect(() => QuotationEntity.create({ total: -5, ... }))
    .toThrow('total must be non-negative');
});
```

**Use Case Tests** - Mocked repositories:
```typescript
const mockRepo = { createQuotation: jest.fn().mockResolvedValue(...) };
const useCase = new CreateQuotationUseCase(mockRepo);
const result = await useCase.execute(quotation);
expect(mockRepo.createQuotation).toHaveBeenCalledWith(quotation);
```

**Repository Integration Tests** - In-memory SQLite:
```typescript
// Uses better-sqlite3 :memory: via mocked react-native-sqlite-storage
const repo = new DrizzleQuotationRepository();
await repo.createQuotation(quotation);
const retrieved = await repo.getQuotation(quotation.id);
expect(retrieved).toEqual(quotation);
```

### Test Commands
```bash
npm test                (TDD Workflow)

**ALWAYS follow this process** (from [CLAUDE.md](CLAUDE.md)):

#### Phase 0: Planning
1. Create design doc: `design/issue-N-feature-name.md`
   - Data model, validation rules, test acceptance criteria
   - Reference existing patterns (e.g., "Follow Invoice module")

#### Phase 1: Domain Layer (Test-First)
2. Define domain entity in `src/domain/entities/`
3. Write **failing** entity validation tests in `__tests__/unit/`
4. Implement entity to make tests pass
5. Define repository interface in `src/domain/repositories/`

#### Phase 2: Infrastructure (Integration Tests)
6. Write **failing** integration tests for repository (in-memory DB)
7. Implement Drizzle repository in `src/infrastructure/repositories/`
8. Update `schema.ts` + generate migration (`npm run db:generate`)
9. Add migration to bundled migrations in `migrations.ts`

#### Phase 3: Application Layer (Use Cases)
10. Write **failing** use case tests (mocked repos)
11. Implement use cases in `src/application/usecases/[feature]/`
12. Wire up hooks in `src/hooks/` (if needed for UI)

#### Phase 4: Verification
13. Run `npm test` - all tests must pass ✅
14. Run `npx tsc --noEmit` - no type errors ✅
15. Update `progress.md` with summary
16. Create PR referencing design doc

**Key Principle**: Write tests BEFORE implementation (Red → Green → Refactor)

### Database Migration Workflow
```bash
# 1. Edit schema.ts
vim src/infrastructure/database/schema.ts

# 2. Generate migration
npm run db:generate
Code Examples

### Domain Entity (with Validation)
```typescript
// Domain validates business rules
const quotationEntity = QuotationEntity.create({
  reference: 'QT-2026-001',
  date: '2026-01-15',
  expiryDate: '2026-02-15',  // Must be >= date
  total: 1500,                // Must be non-negative
  lineItems: [                // Sum must match total
    { description: 'Labor', quantity: 1, unitPrice: 1000 },
    { description: 'Materials', quantity: 1, unitPrice: 500 },
  ],
});

const quotation = quotationEntity.data(); // Get immutable data
```

### Use Case (with Repository)
```typescript
// Use case orchestrates domain logic
class CreateQuotationUseCase {
  constructor(private readonly repo: QuotationRepository) {}
  
  async execute(quotation: Quotation): Promise<Quotation> {
    // Validation happens in entity factory
    const entity = QuotationEntity.create(quotation);
    return this.repo.createQuotation(entity.data());
  }
}

// Usage in hook
const repo = new DrizzleQuotationRepository();
const createUseCase = new CreateQuotationUseCase(repo);
const created = await createUseCase.execute(newQuotation);
```

### React Hook (UI Connector)
```typescript
// Hook wires UI to application layer
export function useQuotations() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const repo = useMemo(() => new DrizzleQuotationRepository(), []);
  
  const createQuotation = useCallback(async (data: Quotation) => {
    const useCase = new CreateQuotationUseCase(repo);
    const created = await useCase.execute(data);
    setQuotations(prev => [...prev, created]);
    return created;
  }, [repo]);
  
  return { quotations, createQuotation };
}
```

### Component (Presentation)
```tsx
// Component is purely presentational
function QuotationCard({ quotation, onEdit, onDelete }: Props) {
  return (
    <View className="p-4 bg-white rounded-lg">
      <Text className="text-lg font-bold">{quotation.reference}</Text>
      <Text className="text-gray-600">${quotation.total}</Text>
      <Button onPress={() => onEdit(quotation.id)}>Edit</Button>
    </View>
  );
}
```

---

## 📚 Project Documentation

### Essential Reading (in order)
1. **[CLAUDE.md](CLAUDE.md)** - Development workflow, TDD process, conventions
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** (this file) - Architecture overview
3. **[progress.md](progress.md)** - Recent changes and current milestone
4. **[DRIZZLE_SETUP.md](DRIZZLE_SETUP.md)** - Database setup and migration workflow
5. **[docs/DATABASE_MIGRATIONS.md](docs/DATABASE_MIGRATIONS.md)** - Migration details
6. **[docs/WORKFLOWS.md](docs/WORKFLOWS.md)** - Project status transition rules
7. **[.github/coding-workflow-shortcuts.md](.github/coding-workflow-shortcuts.md)** - Quick prompts for AI agents

### Design Documents
Feature designs live in `design/` folder:
- `design/issue-64-quotation-module.md` - Quotation CRUD (latest example)
- `design/issue-32-create-project-page.md` - Projects page implementation
- `design/issue-54-snap-receipt-ocr-ai-plan.md` - OCR/ML workflow

### External Resources
- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) - Robert C. Martin
- [Drizzle ORM Docs](https://orm.drizzle.team/docs/overview) - TypeScript ORM
- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [NativeWind Docs](https://www.nativewind.dev/) - Tailwind for React Native

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- React Native development environment
- iOS Simulator or Android Emulator

### Installation
```bash
# Install dependencies
npm install

# iOS setup (macOS only)
cd ios && pod install && cd ..

# Start Metro bundler
npm start

# Run on iOS (separate terminal)
npm run ios

# Run on Android (separate terminal)
npm run android

# Type checking
npx tsc --noEmit

# Run tests
npm test

# Generate database migration (after schema changes)
npm run db:generate
```

### Database Setup
The database auto-migrates on app startup. Migrations are bundled in [src/infrastructure/database/migrations.ts](src/infrastructure/database/migrations.ts).

**Important**: After running `npm run db:generate`, you must bundle the migration:
1. Copy SQL from `drizzle/<migration-name>.sql`
2. Add to `rawMigration000X` constant in `migrations.ts`
3. Add entry to `migrations` array

See [DRIZZLE_SETUP.md](DRIZZLE_SETUP.md) and [docs/DATABASE_MIGRATIONS.md](docs/DATABASE_MIGRATIONS.md) for details.

## 🧪 Testing Strategy

### Unit Tests
- **Domain Layer**: Test business rules and validation logic
- **Application Layer**: Test use case orchestration
- **UI Layer**: Test component rendering and user interactions

### Integration Tests
- Test complete workflows from UI to data persistence
- Test repository implementations

### Example Test Structure
```typescript
// Domain entity test
describe('ProjectEntity', () => {
  it('should validate project data correctly', () => {
    // Test business rules
  });
});

// Use case test
describe('CreateProjectUseCase', () => {
  it('should create project successfully', async () => {
    // Test use case execution
  });
});
```

## 📝 Development Guidelines

### Adding New Features

1. **Start with Domain**: Define entities and business rules
2. **Create Use Cases**: Implement application logic
3. **Build UI**: Create components and hooks
4. **Implement Infrastructure**: Add external dependencies

### Dependency Rules
- ✅ Domain layer has no dependencies on outer layers
- ✅ Application layer depends only on domain layer
- ✅ UI layer depends on application and domain layers
- ✅ Infrastructure layer implements domain interfaces

### Best Practices
- Keep domain entities pure and testable
- Use dependency injection for repositories
- Implement interfaces before concrete classes
- Separate platform-specific code in `/android` and `/ios`
- Use TypeScript for type safety throughout

## 🔧 Configuration

### TypeScript Configuration
The project uses TypeScript with strict type checking enabled. See `tsconfig.json` for configuration details.

### ESLint & Prettier
Code formatting and linting rules are configured in `.eslintrc.js` and `.prettierrc.js`.

### Metro Configuration
React Native bundler configuration in `metro.config.js`.

## 📱 Platform-Specific Code

### iOS (`/ios`)
- Native iOS configuration and dependencies
- Platform-specific implementations when needed

### Android (`/android`)  
- Native Android configuration and dependencies
- Platform-specific implementations when needed

## 🔍 Example Usage

### Creating a New Project
```typescript
const { createProject } = useProjects();

const newProject = {
  name: 'New Construction Project',
  description: 'Modern residential building',
  budget: 500000,
  startDate: new Date(),
  expectedEndDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
};

const result = await createProject(newProject);
```

### Analyzing a Project
```typescript
const { getProjectAnalysis } = useProjects();

const analysis = await getProjectAnalysis(projectId);
if (analysis.success) {
  console.log('Project Analysis:', analysis.analysis);
}
```

## 🤝 Contributing

### Before You Start
1. **Read** [CLAUDE.md](CLAUDE.md) - Required reading for development workflow
2. **Read** [.github/coding-workflow-shortcuts.md](.github/coding-workflow-shortcuts.md) - Quick prompts
3. **Follow TDD** - Tests before implementation (always)

### Pull Request Checklist
- [ ] Design doc created/updated in `design/`
- [ ] Tests written before implementation (TDD workflow)
- [ ] All tests passing (`npm test`)
- [ ] Type checking passes (`npx tsc --noEmit`)
- [ ] Database migrations bundled (if schema changed)
- [ ] `progress.md` updated with summary
- [ ] Code follows Clean Architecture patterns
- [ ] No business logic in UI layer
- [ ] Repository implementations use Drizzle ORM only

### Common Workflows
**Add new entity**: See [.github/coding-workflow-shortcuts.md](.github/coding-workflow-shortcuts.md#combined-full-feature-implementation)

**Database change**: Update `schema.ts` → `npm run db:generate` → bundle migration

**Bug fix**: Write failing test → fix → verify test passes

## 📚 Further Reading

- [Clean Architecture by Robert C. Martin](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)