# Feature: SQLite Persistence

## Goal

The Knowledge Embedding feature already follows the app’s shared repository and SQLite persistence pattern, where domain entities are saved and reloaded through repository interfaces rather than ad hoc in-memory state. This feature ensures the project’s knowledge state survives process restarts and continues to be available from the same persistent data layer after the app is closed and reopened.

The purpose is to preserve a trustworthy, recoverable view of project knowledge so users can continue from the last valid saved state without losing documents, extracted facts, chunked content, or embedding data that has already been accepted by the system.

## System Flow

1. A project exists and the system receives or generates knowledge-related records such as facts, chunks, and embeddings.
2. The system passes the data through the existing repository layer used by the app for persistence.
3. The system validates the record and persists the new or updated state in the app’s shared SQLite-backed storage.
4. Related records are stored in a consistent state so the project’s knowledge can be restored as a coherent whole after restart.
5. When the app is closed and reopened, the system reads the persisted records back through the same repository interfaces and restores the last committed state.
6. If a save fails or is interrupted, the system preserves the previous valid state and does not expose a partially written result as current state.

## Acceptance Criteria

### AC1

**Given** a project with no persisted knowledge state,
**when** the project creates or updates knowledge records through the app’s repository layer,
**then** the system persists all accepted records and makes them available for retrieval after the app is restarted.

### AC2

**Given** the app has previously persisted project knowledge,
**when** the app is closed and reopened,
**then** the system restores the last committed state for the project’s persisted knowledge records without requiring the user to recreate them.

### AC3

**Given** an entity already exists in persistence with the same identifier,
**when** the same entity is saved again,
**then** the system replaces the stored version for that identifier and does not create duplicate persisted entries.

### AC4

**Given** a repository receives invalid or incomplete data,
**when** a save or update is attempted,
**then** the system rejects the operation and does not persist a partial or corrupted record.

### AC5

**Given** the system is writing one or more persisted records,
**when** the write fails or is interrupted,
**then** the previous valid committed state remains available and the system does not expose a partially written result as the current state.

### AC6

**Given** the system is restoring persisted state,
**when** related records are missing or inconsistent due to prior incomplete storage,
**then** the system restores only valid committed records and does not invent missing relationships or silently create inconsistent state.

## Error & Failure Handling

* If a save fails due to a database or storage issue, the system keeps the previously committed state and returns the failure to the caller without applying partial updates.
* If a write is interrupted before completion, the next restart must recover only the last valid persisted state.
* If persisted records are missing required data, the system rejects them and does not retain a broken record.
* If an external dependency is unavailable during a write, the system must not commit a partial state and must preserve the previous valid data.

## Edge Cases

* Repeated save of the same entity identifier.
* Project state restored after app restart with no data loss.
* Incomplete or invalid data submitted for persistence.
* Interrupted write during a multi-entity save sequence.
* Recovery after a failed write when some records were valid and others were not.

## Observability

* Persisted entity creation, update, and restore events should be logged for traceability.
* Write failures, validation rejections, and recovery events should be logged with enough context to identify the affected project and entity type.
* Recovery metrics should capture the number of entities restored and the number of failed or rejected persistence operations.

## Out of Scope

* Designing or prescribing specific database schema implementation details.
* Defining user-facing UI or workflow for manually repairing corrupt data.
* Creating new business rules for content interpretation beyond storing and restoring the project’s knowledge state.

## Rules

1. Acceptance criteria must describe observable system behaviour, not implementation details.
2. Do not prescribe classes, functions, frameworks, libraries, database schemas, or specific implementation techniques unless explicitly provided as requirements.
3. Each acceptance criterion should describe one clear and independently testable behaviour.
4. Acceptance criteria must be specific enough that they can later be converted into automated tests.
5. Consider both normal processing and failure scenarios.
6. Consider duplicate messages, retries, timeouts, invalid input, and dependency failures where relevant.
7. Do not assume that an operation is idempotent unless this has been explicitly stated or confirmed.
8. Do not invent business rules, integration behaviour, or technical requirements that have not been provided or confirmed.
9. If a requirement is ambiguous, ask before producing the final document.
10. Keep the document concise and focused on behaviour and requirements.

## Quality Check

Before producing the final document, verify internally that:

* The Goal explains why the system feature exists.
* The System Flow describes the expected processing lifecycle.
* Every important processing step is covered by at least one acceptance criterion.
* Success behaviour is covered.
* Important failure scenarios are covered.
* Important edge cases are covered.
* Duplicate/retry behaviour has been considered where relevant.
* Acceptance criteria are independently testable.
* No unnecessary implementation details have been introduced.
* No unconfirmed assumptions have been presented as requirements.
