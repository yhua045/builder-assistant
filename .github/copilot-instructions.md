# Agent Execution Protocol
When working on new features or task tickets, strictly follow this sequential state machine. Do not skip phases:

1. **PHASE 1 (Design):** Read requirements. Propose domain model, key abstractions, and source code structure. STOP and await human confirmation.
2. **PHASE 2 (Tests):** Write comprehensive test cases (TDD). STOP and await human confirmation. Note: Default step but can be skipped if specifically instructed by the user, otherwise, always write tests first.
3. **PHASE 3 (Implementation):** Implement code to pass tests.
4. **PHASE 4 (Review & Refactor):** Clean up, optimize, and verify coverage.