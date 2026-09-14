# Feature: Persisted Document Processing Queue and Resume

## Goal

Persist documents waiting for knowledge processing so the document workflow survives app backgrounding, screen unmounting, and app interruption. The system must be able to reload pending work when the app returns to the foreground and resume or expose it for retry without losing the user's documents or processing state.

The persisted document records are the source of truth for the document list. Each record must retain its current processing status and error details so the user can understand failures and manually retry them.

## System Flow

1. The user adds a document to the knowledge processing flow.
2. The system atomically persists the document and its initial processing state in the existing durable queue or database.
3. The document list is read from persisted records and reflects the current durable state.
4. Processing updates the specific document record with its current status and any error details.
5. If processing is interrupted or the app moves to the background, the durable record remains available for recovery.
6. When the app returns to the foreground or is reopened, the system reloads persisted document records.
7. Pending or interrupted documents resume processing where possible; documents that cannot resume automatically remain available for manual retry.
8. When the user removes a document, the system atomically removes its persisted queue/database record and associated local file reference.

## Acceptance Criteria

### AC1

**Given** a valid document is not already present in the processing queue,
**when** the user adds the document,
**then** the system persists the document record with its identity, metadata, local file reference, and initial processing status before reporting the add operation as successful.

### AC2

**Given** a document with the same identity is already persisted,
**when** the user adds it again,
**then** the system does not create a duplicate persisted record or duplicate processing request, and the operation is treated as successfully handled.

### AC3

**Given** document records exist in durable storage,
**when** the document list is displayed or reloaded,
**then** the list is derived from those persisted records and reflects their current statuses and error details rather than relying on a separate in-memory document list.

### AC4

**Given** a persisted document is being processed,
**when** its processing status changes,
**then** the system updates only that document's persisted status and records relevant error details when processing fails.

### AC5

**Given** a document processing attempt fails,
**when** the failure is recorded,
**then** the document remains persisted, its failure status and actionable error details are available to the user, and a manual retry can be initiated.

### AC6

**Given** the app is backgrounded, suspended, the flow screen is unmounted, or the process is interrupted while documents are pending,
**when** the app returns to the foreground or is reopened,
**then** the system reloads the persisted document records without losing pending work or recorded status.

### AC7

**Given** a persisted document was interrupted while processing,
**when** recovery runs after the app returns to the foreground,
**then** the system resumes from the last durable processing state where automatic recovery is possible, without duplicating completed work.

### AC8

**Given** a persisted document cannot be resumed automatically,
**when** the document list is reloaded,
**then** the system presents the document's failure or interrupted status and provides a manual retry action.

### AC9

**Given** a document is persisted,
**when** the user removes it,
**then** the system removes the document from durable storage and removes its associated local file or stored-file reference before reporting the removal as successful.

### AC10

**Given** a document is already absent from durable storage,
**when** the user removes it,
**then** the operation succeeds idempotently and does not create an error state.

### AC11

**Given** persistence fails while adding or removing a document,
**when** the operation completes with that failure,
**then** the operation is reported as unsuccessful, no partial database, queue, file, or in-memory state change is exposed, and the user is notified that the operation can be retried.

### AC12

**Given** the app is interrupted during an add or remove operation,
**when** the app next reloads the document records,
**then** the system resolves the operation from durable state without exposing a partially committed document or silently losing an existing document.

## Error & Failure Handling

* A document must not appear as successfully added until its durable record and required local file persistence have succeeded.
* A failed add must leave no newly created document record or orphaned local file visible to the flow.
* A failed remove must leave the existing document record and local file available for retry; an already-absent record is treated as successfully removed.
* Processing failures must preserve the document record, current resumable state, error details, and retry eligibility.
* If the app is interrupted during processing, recovery must use the last durable state and must not assume that an in-memory status update was committed.
* If automatic resume cannot safely determine the next operation, the document must remain recoverable through manual retry rather than being marked completed.
* Repeated foreground events or retry requests must not create duplicate processing work for the same document identity.

## Edge Cases

* The same document is added repeatedly before, during, or after processing.
* The app is backgrounded during file persistence, queue insertion, status update, or deletion.
* The app is terminated after a file is persisted but before its database record is committed, or vice versa.
* A persisted document has an interrupted, uploading, failed, or retryable status when the app starts.
* A document's local file no longer exists when its persisted record is reloaded.
* The user removes a document while processing or while a retry is pending.
* The database or persistence queue is unavailable during foreground recovery.
* A stored error detail is missing, malformed, or not actionable.

## Observability

* Record document add, remove, resume, retry, and recovery events with the document identity and resulting status.
* Record persistence failures with the operation type and enough context to diagnose whether the database, queue, or local file operation failed.
* Record processing status transitions and error details for each document.
* Record interrupted operations and the durable state selected during recovery.
* Provide metrics or monitoring for failed persistence operations, automatic resumes, manual retries, and documents stuck in retryable states.

## Out of Scope

* Replacing the existing queue or database with a new persistence system.
* Defining the internal database schema, repository classes, or file-system library used to implement persistence.
* Automatically retrying permanently invalid documents without user action.
* Synchronizing pending documents or their files to a remote cloud service.
* Defining the visual design of the document list or retry control beyond making status, errors, and retry availability observable to the user.

## Rules

1. Acceptance criteria must describe observable system behaviour, not implementation details.
2. Do not prescribe classes, functions, frameworks, libraries, database schemas, or specific implementation techniques unless I explicitly provide them as requirements.
3. Each acceptance criterion should describe one clear and independently testable behaviour.
4. Acceptance criteria must be specific enough that they can later be converted into automated tests.
5. Consider both normal processing and failure scenarios.
6. Consider duplicate messages, retries, timeouts, invalid input, and dependency failures where relevant.
7. Do not assume that an operation is idempotent unless this has been explicitly stated or confirmed.
8. Do not invent business rules, integration behaviour, or technical requirements that I have not provided or confirmed.
9. If a requirement is ambiguous, ask me before producing the final document.
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
