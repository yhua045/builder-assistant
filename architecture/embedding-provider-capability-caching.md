# Feature: Embedding Provider Capability Caching and Service Naming Cleanup

## 1. Architectural Context

### Relevant Existing Components

| Component | Responsibility | Relevance to Feature |
| --------- | -------------- | -------------------- |
| src/features/knowledge-embedding/application/services/EmbeddingProviderEmbeddingService.ts | Defines the embedding contract, provider selection, fallback behavior, and retry wrapper. | This is the primary implementation area. The current class name and inheritance structure are the source of confusion and the feature's refactor target. |
| src/shared/infrastructure/di/registerServices.ts | Registers app services via tsyringe and wires the configured embedding provider. | This is where the embedding service and config are instantiated; it should be updated to use the new naming and persistent capability result. |
| src/shared/infrastructure/config/featureFlags.ts | Stores static app configuration flags used at runtime. | Acts as the existing pattern for small app-level config state and is the closest architectural precedent for a cached capability flag. |
| src/shared/ui/hooks/useAnalyticsOptOut.ts | Demonstrates persisted local app preference via AsyncStorage. | Shows the repo's established pattern for a small boolean setting stored locally and read on startup. |
| src/features/knowledge-embedding/tests/unit/EmbeddingProviderEmbeddingService.test.ts | Verifies the expected embedding service behavior and failure cases. | Existing tests should be updated to validate the cache-on-missing behavior and the renamed service without changing the public contract. |

### Architectural Constraints

* Preserve the existing tsyringe dependency injection pattern and keep the embedding service initialization simple.
* Keep the feature local to the knowledge-embedding boundary unless the new app-config abstraction is clearly shared and reusable.
* Do not introduce a broad config framework or a second persistence mechanism for a single boolean capability flag.
* Preserve the current fallback contract: if native support is unavailable, the app must continue with local deterministic embeddings instead of failing the embedding flow.
* Keep the runtime compatibility decision stable once stored; do not re-evaluate on every startup or every embedding request.
* The naming cleanup should improve readability without changing the external behavior of the embedding contract.

---

## 2. Proposed Architecture

### Abstract Interfaces/Contracts/DTOs Source Code Structure

Proposed source layout:

```text
src/
  features/
    knowledge-embedding/
      infrastructure/
        config/
          embeddingRuntimeConfig.ts        # knowledge-embedding-specific cached capability flag
      application/
        services/
          EmbeddingRuntimeService.ts       # renamed provider-backed service
          EmbeddingProviderConfig.ts       # config contract (if split for clarity)
          EmbeddingModels.ts               # model factory and local/native model implementations
          EmbeddingService.ts              # shared interface contract
      tests/
        unit/
          EmbeddingRuntimeService.test.ts
```

Suggested model boundaries:

```ts
interface EmbeddingRuntimeConfig {
  provider: string;
  modelVersion?: string;
  dimension: number;
  nativeSupport?: boolean;
}

interface EmbeddingService {
  readonly provider: string;
  readonly modelVersion?: string;
  readonly dimension: number;
  embed(text: string): Promise<Float32Array>;
  embedBatch(texts: string[]): Promise<Float32Array[]>;
  embedWithRetry(text: string, retries?: number): Promise<Float32Array>;
}

interface AppEmbeddingCapabilityStore {
  getNativeEmbeddingSupport(): Promise<boolean | null>;
  setNativeEmbeddingSupport(value: boolean): Promise<void>;
}
```

The actual implementation should remain intentionally small:

* `EmbeddingRuntimeService` is the configured provider-backed embedding runtime and should compose a chosen `EmbeddingModel` instance rather than inherit from a fallback service.
* `LocalEmbeddingService` should be treated as a factory result or concrete fallback strategy, not as a subtype of the runtime service.
* `embeddingRuntimeConfig.ts` inside the knowledge-embedding feature holds the capability decision, not the runtime object itself.
* The capability gate is resolved once, only when no value is present.

### Data Flow

```text
App bootstrap
    ↓
Embedding config loader
    ↓
If capability flag missing:
    evaluate native ExecuTorch support
    store boolean in app config
Else:
    read cached boolean from app config
    ↓
Provider selection
    ↓
EmbeddingRuntimeService 
    ↓
Embedding Model (native or local fallback)
    ↓
Embedding request executes
```

Important transitions:

* Startup configuration is read before the service is created.
* The capability check is not triggered during every request.
* The persisted boolean is treated as the source of truth for the current app lifecycle.
* Only a cleared value re-triggers evaluation.

### State Flow

```text
MissingCapability
  ↓
EvaluatingNativeSupport
  ↓
Supported --> NativeProviderSelected
Unsupported --> LocalFallbackSelected

NativeProviderSelected
  ↓
EmbeddingExecuted

LocalFallbackSelected
  ↓
EmbeddingExecuted
```

State semantics:

* `MissingCapability`: no value persisted in app config.
* `EvaluatingNativeSupport`: the app performs the lightweight support check once.
* `Supported` / `Unsupported`: final decision stored in config.
* `NativeProviderSelected` / `LocalFallbackSelected`: runtime selection state used before embedding execution.

---

## 4. Data / Persistence Changes

No persistence changes are required beyond a lightweight app-config boolean representing native embedding capability.

Proposed persisted value:

```ts
interface EmbeddingCapabilityState {
  nativeEmbeddingSupported: boolean;
}
```

This should be stored in the app configuration layer, consistent with the repository's existing pattern for small local preferences.

Implementation notes:

* The preferred storage mechanism is a small app-config or AsyncStorage-backed preference, not a database entity.
* The value should be read at app startup and cached in memory for the active session after the first successful load.
* The boolean is treated as stable after initialization; only a deliberate reset clears it and causes the one-time setup check again.

---

## 5. Error Handling & Resilience

* Invalid or missing app-config value: treat as `missing capability` and perform one evaluation before continuing.
* Native module missing or unusable: continue with the local deterministic fallback; do not crash the embedding workflow.
* Unsupported provider string: fail the provider resolution clearly and keep the system in a deterministic fallback path when configured.
* Invalid embedding payload from the native layer: fail the provider-backed call with a clear error and avoid silently returning invalid vectors.
* Duplicate embedding requests while capability is being initialized: use the same cached result once it is stored; avoid repeated checks.
* User cancellation or navigation during startup: no special handling is needed beyond the app config value being loaded lazily, as this is a non-blocking startup decision.
* Inheritance should be avoided here; the runtime should compose the chosen model strategy rather than rely on a subclass relationship between the fallback and the runtime.

---

## 6. Implementation Sequence

1. Define the persisted capability value and the app-config access contract.
2. Rename the provider-backed runtime service to a clearer responsibility-based name while preserving the embedding contract.
3. Refactor the service to compose a selected `EmbeddingModel` instead of relying on inheritance between runtime and fallback strategies.
4. Update the DI registration in src/shared/infrastructure/di/registerServices.ts to resolve the capability from app config once and then construct the selected service.
5. Keep the existing local deterministic fallback explicitly separate as a concrete model strategy rather than as a subclass of the runtime.
6. Update the unit tests to cover: missing config triggers one-time evaluation, saved config skips re-evaluation, unsupported native provider falls back correctly, and naming changes do not alter behavior.
7. Validate the embedding feature through the existing targeted jest suite for knowledge-embedding.

---
