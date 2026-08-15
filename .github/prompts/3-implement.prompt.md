---
description: Phase 3 - Implement feature code to pass the tests
---
Implement the feature logic strictly following the approved design plan and existing test suite:

### Pre-Implementation Check (Mandatory)
1. **Duplicate Prevention:** Scan the existing codebase for pre-existing utility functions, extension methods, domain models, or service classes that overlap with this task. Reuse or extend existing classes instead of defining redundant ones.
2. **Pattern Alignment:** Match the project's existing coding idioms (e.g., error handling conventions, logging strategies, dependency injection registrations, and state management patterns).

### Implementation Requirements
1. Write minimal, clean production code that fulfills the abstractions defined in Phase 1 and passes the tests from Phase 2.
2. **Error Handling & Resilience:** Maintain the codebase's existing error handling strategy (e.g., explicit result types, standard exception handling, logging context).
3. **Dependency Injection & Coupling:** Ensure new services are properly configured for dependency injection and adhere to the Single Responsibility Principle (SRP).
4. Do not alter existing public API contracts or interface signatures unless explicitly required by the design plan.
5. Run all target tests and verify that the test suite passes completely.