# Feature: Embedding Provider Capability Caching and Service Naming Cleanup

## Goal

The system needs a clearer and more efficient embedding model selection flow for mobile devices. It must determine whether the device supports the native ExecuTorch embedding runtime when the capability is missing from app configuration, persist that result, and reuse it for the remainder of the app lifecycle. The goal is to avoid repeated runtime checks, keep startup evaluation lightweight, and make the service naming reflect the actual responsibility of the embedding runtime rather than a confusing generic abstraction.

## System Flow

1. The app starts and loads app configuration for the embedding subsystem.
2. The system checks whether the device compatibility value is already present in app configuration.
3. If the value is missing, the system evaluates whether the current device supports the native `react-native-executorch` embedding model and records the result in app configuration.
4. If the value already exists, the system reuses the saved result and does not run another compatibility check during the current app lifecycle.
5. The app resolves the configured embedding provider and decides whether to use the native provider-backed implementation or the local deterministic fallback.
6. The embedding service performs the requested embedding operation using the selected provider implementation.
7. If the native capability is unavailable or the provider is unsupported, the app uses the local fallback behavior and continues processing without failing the embedding workflow.

## Acceptance Criteria

### AC1

**Given** the app is configured for embedding support and the compatibility value is absent from app config,
**when** the embedding subsystem initializes,
**then** it evaluates whether the current device supports the native `react-native-executorch` embedding model and persists that result in app config.

### AC2

**Given** the native embedding capability result has already been stored in app config,
**when** the app starts again or later creates an embedding service,
**then** it reuses the saved value and does not perform another compatibility evaluation during that app lifecycle.

### AC3

**Given** the device supports the native embedding model,
**when** the app selects the provider-backed embedding path,
**then** it uses the native provider implementation for embedding requests as configured by the application state.

### AC4

**Given** the device does not support the native embedding model or the provider is unavailable,
**when** the app attempts to use the embedding service,
**then** it falls back to the local deterministic embedding behavior without failing the overall embedding workflow.

### AC5

**Given** the compatibility value is already configured in app config,
**when** the app continues to use the embedding service,
**then** it treats the support decision as stable and does not invalidate or re-run the startup evaluation unless the config is intentionally cleared.


## Error & Failure Handling

* If the native model is not available on the device, the system should use the supported local fallback behavior and continue processing without a runtime crash.
* If the app config is missing the cached capability value, the system should evaluate support once and then persist the result before continuing.
* If the stored compatibility value is invalid or empty, the system should treat it as missing and perform a single evaluation to restore a valid value before continuing.
* If the native provider is present but cannot return a valid embedding payload, the system should fail the provider-backed operation clearly and not silently return incorrect embeddings.

## Edge Cases

* A fresh install or first launch with no cached capability result.
* A device that has the native dependency installed but the provider is not actually usable.
* A configuration value that is absent, empty, or invalid and therefore needs a single evaluation to establish a valid state.
* Duplicate embedding requests while the capability cache is being initialized.
* A missing or unsupported provider name in the configured embedding settings.
* An app lifecycle where the capability value is already stored and should not be re-evaluated unless configuration is cleared.

## Observability

* Log the result of the capability evaluation when the app config value is missing and must be initialized.
* Log when the application falls back to the local deterministic embedding implementation because native capability is unavailable.
* Log invalid or unexpected embedding provider state when the stored capability value is missing, empty, or invalid and must be recovered.
* Record a clear error when a provider-backed embedding attempt returns invalid output or fails validation.

## Out of Scope

* Replacing the embedding algorithm itself with a different vector-generation approach.
* Introducing a second persistence mechanism outside the app configuration for capability state.
* Changing unrelated document-chunking or workflow logic that does not depend on the embedding provider selection.
* Prescribing a specific class, interface, or library implementation beyond the requirement that the system uses a cached capability decision and a clearer service name.

## Rules

1. Acceptance criteria must describe observable system behaviour, not implementation details.
2. Do not prescribe classes, functions, frameworks, libraries, database schemas, or specific implementation techniques unless explicitly required.
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
