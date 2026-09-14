# Feature: Hybrid Retrieval for Construction Documents

## Goal

Construction project knowledge often contains both natural-language questions and exact specification references such as section numbers, material codes, and standard references. This feature provides a single retrieval flow that can answer both conversational and literal queries by combining concept-based similarity search with exact text matching, then returning the most relevant document chunks in ranked order.

The system exists to help users find the right project specification, standard, or requirement quickly even when their wording differs from the source material. It must return only the most relevant results, support both semantic and literal search in the same workflow, and clearly distinguish no-match results from operational failures.

## System Flow

1. A user submits a retrieval query that may be a natural-language question, an exact term, or a mixed query containing both.
2. The system evaluates the query through both semantic retrieval and exact-match retrieval in the same retrieval flow.
3. The semantic path finds conceptually related chunks using similarity against stored embeddings, while the exact-match path finds literal or terminology-based matches using full-text search.
4. The system merges the results from both retrieval paths, ranks the combined candidate set, and selects the highest-value top-k results.
5. The system returns the ranked chunk results together with enough metadata to identify the source document, section, page, or chunk.
6. If no relevant results are found, the system returns an empty result state; if retrieval fails operationally, it returns a recoverable failure state with logging for diagnosis.

## Acceptance Criteria

### AC1

**Given** a user submits a natural-language question about project requirements,
**when** the retrieval flow runs,
**then** the system returns the most relevant document chunks identified by semantic similarity and ranks them in order of relevance.

### AC2

**Given** a user submits an exact term or technical reference such as a section number, material code, or standard identifier,
**when** the retrieval flow runs,
**then** the system includes the matching literal results from the document text and ranks them alongside any semantic matches.

### AC3

**Given** a query contains both conceptual wording and exact terminology,
**when** the retrieval flow runs,
**then** the system evaluates both retrieval paths and combines the results into a single ranked candidate set before limiting the output to the configured top-k results.

### AC4

**Given** the system has identified multiple candidate matching chunks,
**when** the merge and ranking step executes,
**then** the output is ordered by relevance so that the strongest matches appear first and weaker matches are excluded once the top-k limit is reached.

### AC5

**Given** the retrieval system does not find any relevant chunks for a valid query,
**when** the search completes,
**then** the system returns an empty result state rather than a misleading or fabricated answer.

### AC6

**Given** a retrieval request is made for a document subset or project-scoped search,
**when** the system executes the retrieval flow,
**then** the results are limited to the authorized document scope and retain enough metadata to identify their source document, section, page, or chunk.

### AC7

**Given** the semantic retrieval path is unavailable or fails,
**when** the overall retrieval flow is triggered,
**then** the system continues with the available exact-match path or returns a recoverable failure state without reporting a successful search that is missing its expected data.

### AC8

**Given** the full-text retrieval path is unavailable or fails,
**when** the overall retrieval flow is triggered,
**then** the system continues with the available semantic path or returns a recoverable failure state without treating a partial result as a complete answer.

### AC9

**Given** both retrieval paths fail during the same search request,
**when** the system attempts to complete the retrieval flow,
**then** it surfaces a clear operational failure state and logs enough context to diagnose which step failed.

## Error & Failure Handling

* If semantic retrieval fails because the embedding service is unavailable or degraded, the system must not present partial success as a valid result set; it should continue with available data or return a recoverable failure state.
* If full-text retrieval is unavailable, the system should continue using the semantic path when possible and must not mask the failure as a successful result.
* If both retrieval paths fail, the system must return a clear failure state to the caller and log the failure with enough context to identify the failing step.
* If no relevant results are found, the system must return an empty result state and distinguish it from an operational failure state.
* If the system cannot rank or limit the merged candidates correctly, it must surface the failure rather than returning an untrusted or incomplete result list.

## Edge Cases

* A query that is purely conversational and has no exact match terms.
* A query that is purely a technical reference and has no semantic context.
* A mixed query containing both conceptual language and exact specification identifiers.
* A request where one retrieval path returns zero results and the other returns valid matches.
* A search where multiple documents contain similar wording and the retrieval flow must still select the most relevant subset.
* Repeated or duplicate retrieval requests for the same query.
* Invalid or empty query input.
* An authorized search scope with no matching records available.

## Observability

* Log each retrieval request with enough context to identify the query type, document scope, and retrieval path used.
* Log when the semantic retrieval path succeeds or fails and when the full-text retrieval path succeeds or fails.
* Log when results are merged, ranked, and top-k selection is applied, including the number of matches found before and after filtering.
* Emit metrics for query volume, retrieval latency, total candidate matches, zero-result searches, and failures by retrieval stage.
* Log operational failures with enough detail to distinguish a no-match result from a system-level retrieval error.

## Out of Scope

* Defining how the user interface displays or renders the results.
* Prescribing specific embedding models, retrieval algorithms, or database schema details beyond the requirement to use semantic and full-text search paths.
* Defining business rules for approval, editing, or document curation workflows outside retrieval behaviour.
* Introducing new product logic for answer generation, summarization, or validation beyond retrieving the most relevant document chunks.

## Rules

1. Acceptance criteria must describe observable system behaviour, not implementation details.
2. Do not prescribe classes, functions, frameworks, libraries, database schemas, or specific implementation techniques unless explicitly provided as requirements.
3. Each acceptance criterion should describe one clear and independently testable behaviour.
4. Acceptance criteria must be specific enough that they can later be converted into automated tests.
5. Consider both normal processing and failure scenarios.
6. Consider duplicate messages, retries, timeouts, invalid input, and dependency failures where relevant.
7. Do not assume that an operation is idempotent unless this has been explicitly stated or confirmed.
8. Do not invent business rules, integration behaviour, or technical requirements that I have not provided or confirmed.
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
