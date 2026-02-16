# Coding Workflow Shortcuts

Quick reference keywords and prompts for working with GitHub Copilot and AI coding agents.

## TDD Workflow (from CLAUDE.md)

### Keywords to Invoke TDD Workflow

Use any of these phrases to ensure the agent follows the full TDD process:

- **"Use TDD workflow"** - Full Test-Driven Development cycle
- **"Design-first TDD"** - Emphasizes starting with design doc
- **"Test-first approach"** - Write tests before implementation
- **"Follow TDD from CLAUDE.md"** - Explicit reference to project standards

### Reusable Prompts

#### Starting a New Feature
```
Implement [feature name] using TDD workflow from CLAUDE.md:
1. Create design doc in design/
2. Write failing tests first
3. Implement to make tests pass
4. All code must follow Clean Architecture

Reference: [GitHub issue or requirement]
```

#### Adding to Existing Module
```
Add [functionality] to [module] using TDD:
- Follow existing patterns from [similar module]
- Write tests first
- Maintain layer separation
- Update design doc if needed
```

#### Bug Fix with TDD
```
Fix [bug] using test-first approach:
1. Write test that reproduces the bug (should fail)
2. Implement minimal fix to make test pass
3. Refactor if needed
```

## Clean Architecture Shortcuts

### Keywords
- **"Follow Clean Architecture"** - Enforce layer separation
- **"Domain-first approach"** - Start with domain entities/interfaces
- **"Use repository pattern"** - Interface in domain, impl in infrastructure

### Quick Checklist Prompt
```
Implement [feature] following these rules:
✓ Domain entities with validation (src/domain/entities/)
✓ Repository interface (src/domain/repositories/)
✓ Use cases (src/application/usecases/)
✓ Drizzle repository (src/infrastructure/repositories/)
✓ Tests: unit + integration
✓ Follow existing [X] module patterns
```

## Database Changes

### Keywords
- **"Drizzle migration workflow"** - Schema change → generate → test
- **"Migration-safe changes"** - Ensure backward compatibility

### Prompt
```
Add [database change] following migration workflow:
1. Update schema.ts
2. Run npm run db:generate
3. Add migration to bundled migrations in migrations.ts
4. Write integration tests with in-memory DB
5. Verify migration applies cleanly
```

## Testing Reminders

### Keywords
- **"Full test coverage"** - Unit + integration tests
- **"Test pyramid approach"** - More unit tests, fewer integration tests

### Prompt
```
Ensure comprehensive tests:
- Entity validation tests (unit)
- Repository contract tests (integration)
- Use case tests (unit with mocks)
- All tests must pass before PR
```

## Documentation Updates

### Keywords
- **"Update progress.md"** - Document what was done
- **"Add design doc"** - Create planning document first

### Prompt
```
After implementation, update:
1. progress.md with summary
2. ARCHITECTURE.md if patterns changed
3. Design doc in design/ folder
4. Link to GitHub issue
```

## Combined: Full Feature Implementation

### The "Ultimate Prompt" for New Features

```
Implement [feature name] for issue #[number]:

**Workflow**: Follow TDD workflow from CLAUDE.md
**Architecture**: Clean Architecture with Drizzle ORM
**Pattern**: Follow existing [similar module] patterns

**Steps**:
1. Create design doc (design/issue-[N]-[name].md)
2. Domain entity + repository interface (write tests first)
3. Drizzle repository (integration tests)
4. Database migration (generate + bundle)
5. Use cases (unit tests with mocks)
6. Verify all tests pass + type checking
7. Update progress.md

**Deferred to Phase 2**: UI components (separate ticket)

**Verification**:
- [ ] Design doc created
- [ ] All tests passing (npm test)
- [ ] Types check (npx tsc --noEmit)
- [ ] Migration bundled
- [ ] progress.md updated
```

## Quick Daily Phrases

For routine work:

| Phrase | Meaning |
|--------|---------|
| "Standard TDD" | Design doc → tests → implementation |
| "Follow the patterns" | Match existing similar code |
| "Domain-first" | Start with entities + interfaces |
| "Test coverage" | Unit + integration tests required |
| "Clean layers" | No shortcuts in architecture |
| "Migration safe" | Backward-compatible DB changes |

## Examples from This Project

**Good prompts used in issue #64 (Quotation module)**:
```
✓ "Follow the instructions in the agent MD files"
✓ "Use TDD workflow from CLAUDE.md"
✓ "Follow existing Invoice module patterns"
✓ "Write failing tests first"
✓ "Update progress.md with summary"
```

## Tips for Better Results

1. **Be specific about patterns**: "Follow Invoice module patterns" is better than "Do it right"
2. **Reference the instruction files**: Mention CLAUDE.md explicitly
3. **Break into phases**: "Phase 1: Domain & Data, Phase 2: UI"
4. **Always mention tests**: "Write tests first" or "Full test coverage"
5. **Use existing code as examples**: "Like DrizzleInvoiceRepository but for Quotation"

## One-Liner Shortcuts

Copy-paste these for common scenarios:

```bash
# New CRUD module
"Implement [Entity] CRUD following TDD workflow from CLAUDE.md, use [SimilarEntity] as reference"

# Add use case
"Add [UseCase] with unit tests, follow existing use case patterns"

# Fix bug
"Fix [bug] test-first: write failing test, then minimal fix"

# Database change
"Add [table/column] to schema, generate migration, update bundled migrations"

# Repository method
"Add [method] to [Repository] with integration test, follow repository patterns"
```

---

**Pro Tip**: Keep this file open in a tab and copy-paste the prompts! The agent will consistently follow project conventions when you use these structured requests.
