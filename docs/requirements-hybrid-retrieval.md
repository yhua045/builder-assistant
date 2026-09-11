# [Feature]: Hybrid Retrieval for Construction Documents

## 1. Summary & Objective
- **Context:** Construction project documentation contains both conceptual questions and exact specification references. Users need a retrieval system that can answer questions using either natural-language meaning or precise terminology such as section numbers, material codes, and standard references.
- **Goal:** Provide a hybrid retrieval pipeline that combines semantic vector search and exact-match full-text search, merges the results, and returns the most relevant document chunks for both conversational and literal queries.

## 2. Functional Requirements (Non-Technical & Business View)
- **User Personas / Actors:**
  - Project managers reviewing specification questions
  - Field teams and subcontractors looking up standards and requirements
  - Knowledge users searching prior project documents for answers
  - Admins or document curators maintaining indexed project knowledge
- **User Stories & Workflows:**
  - *As a project user, I want to ask a natural-language question like “What reinforcement does the slab require?” so that I can find the relevant project specification without needing exact wording.*
  - *As a project user, I want to search for exact terminology like “S201” or “SL92” so that I can find the precise clause or section that governs the requirement.*
  - *As a user, I want the system to combine semantic and literal matches so that I receive the most relevant document passages even when wording differs from the source text.*
  - *As a user, I want the retrieved passages to be ranked and limited to the most relevant top results so that I can act quickly on the answer.*
- **Business Rules & Input Validations:**
  - The system must support both semantic queries and exact-term queries in the same retrieval flow.
  - The query may be a natural-language question, a technical phrase, or a mixed query containing both conceptual and exact terminology.
  - Results should be returned in ranked order, with the best matches first.
  - Search results must be limited to a configurable top-k set for response quality and performance.
  - If no relevant results are found, the system should return an empty result state rather than a misleading answer.

## 3. Technical Requirements (Engineering View)
- **Domain Capabilities Required:**
  - A retrieval request pipeline that accepts a user query and optionally scope constraints.
  - A semantic retrieval path using vector similarity to find conceptually related chunks.
  - An exact-match retrieval path using FTS5 or equivalent full-text search to find literal and terminology-based matches.
  - A merge-and-rank step that combines semantic and exact results into a single ranked candidate set.
  - A top-k result selection step that returns the most relevant chunks for presentation to the user.
- **Integration Points:**
  - The feature must integrate with the existing indexed knowledge chunks and document metadata already stored in the app.
  - It must work with the current local embedding model and stored embeddings used for semantic retrieval.
  - It must leverage the SQLite full-text search capability already available in the app stack for literal retrieval.
  - It must integrate with the application’s existing result display and document source tracing workflow.
- **Data & Persistence Needs:**
  - Persisted chunks must remain the canonical source for retrieval content.
  - Stored embeddings must remain available for semantic similarity search.
  - Full-text indexed text content must be available for exact-match lookup against document bodies and metadata.
  - Results must retain enough metadata to trace each hit back to its source document, section, page, or chunk.

## 4. Cross-Cutting & Non-Functional Considerations
- **Performance & Latency:**
  - The hybrid retrieval flow should return highly relevant results quickly enough to support interactive user queries.
  - Semantic and FTS pathways should run in parallel or in a coordinated manner to minimize total retrieval latency.
  - The final ranking step should prioritize relevance quality without exposing the user to excessive irrelevant results.
- **Security & Permissions:**
  - Search results must respect any existing document or project scoping rules already enforced in the system.
  - The system must not expose content beyond the user’s authorized document scope.
- **Error Handling & Resilience:**
  - If semantic search fails or the embedding service is unavailable, the system should degrade gracefully without returning inaccurate or empty results as if they were valid.
  - If full-text search is unavailable, the system should continue with the available retrieval path or return a recoverable error.
  - If both retrieval paths fail, the system should surface a clear failure state for the caller and log the issue.
  - Empty result states must be distinguishable from operational failures so users and developers can tell “no match” from “system issue.”
- **Observability:**
  - Emit metrics for query volume, retrieval latency, total matches found, and zero-result searches.
  - Log when semantic search, FTS lookup, merge/rank, and top-k selection succeed or fail.
  - Log enough context to diagnose which side of the hybrid retrieval pipeline caused a failure or poor result quality.
