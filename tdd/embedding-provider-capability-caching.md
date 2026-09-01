# Test Blueprint: Embedding Provider Capability Caching and Service Naming Cleanup

## 1. Test Scenarios & Purposes

### Domain Entity & Validation Tests

| Area | Scenario | Purpose |
| ----- | -------- | ------- |
| Capability config | Capability value is missing from app config | Confirms the system performs a one-time evaluation and stores the resulting boolean. |
| Capability config | Capability value is present and valid | Confirms the system reuses the cached value and does not re-run detection during the same app lifecycle. |
| Capability config | Stored value is empty, null, or invalid | Confirms the config is treated as missing and a fresh evaluation occurs once. |
| Runtime selection | Device supports native embedding | Confirms the runtime chooses the native model path. |
| Runtime selection | Device does not support native embedding | Confirms the runtime selects the local fallback path. |
| Contract stability | Service contract exposes the same embed/embedBatch/embedWithRetry behavior | Confirms the refactor preserves observable behavior while improving naming and composition. |
| Boundary validation | Provider config missing or malformed | Confirms the initialization path rejects invalid config consistently. |

### Workflow & State Transition Tests

Primary state flow:

```text
MissingCapability
  -> EvaluatingNativeSupport
  -> Supported / Unsupported
  -> NativeProviderSelected / LocalFallbackSelected
  -> EmbeddingExecuted
```

Key verification points:

* Missing capability must trigger evaluation exactly once.
* Supported and unsupported states must persist to app config.
* Once cached, the decision must remain stable unless config is intentionally cleared.
* Local fallback must remain the valid branch for unsupported native environments.
* The runtime should not re-enter evaluation on every request or on every app restart when the capability is already stored.

Forbidden or invalid transitions to cover:

* Re-evaluating support after the value is already cached without a config reset.
* Switching from native to local mode mid-session without a config change.
* Failing embedding requests when the local fallback is the correct path.
* Returning an invalid embedding vector from the selected runtime model.

### Contract & API Surface Tests

Target behaviors to validate:

* The runtime entry point exposes a stable contract for embedding operations.
* The capability store contract reads and writes the persisted support value reliably.
* The provider-backed runtime and local fallback both satisfy the same embedding contract.
* Error handling remains explicit when a native provider is unavailable or returns invalid data.
* The app config drives the runtime selection, not repeated runtime inspection.

---

## 2. Test Execution Plan

| Test ID | Target Component / Interface | Scenario / Trigger | Expected Behavioral Outcome | Test Type |
| ------- | --------------------------- | ----------------- | ---------------------------- | --------- |
| EP-01 | App embedding capability store | Capability flag absent from config on startup | System evaluates native support once and persists the result. | Unit |
| EP-02 | App embedding capability store | Capability flag present and valid | System reads the cached value and skips re-evaluation during the same app run. | Unit |
| EP-03 | App embedding capability store | Stored value is null/empty/invalid | System treats it as missing and performs a single re-evaluation. | Unit |
| EP-04 | Embedding runtime resolver | Native support is true | Runtime selects the native provider-backed model path. | Unit |
| EP-05 | Embedding runtime resolver | Native support is false | Runtime selects the local deterministic fallback path without failing the workflow. | Unit |
| EP-10 | Provider selection flow | Repeated embedding operations in same lifecycle | Runtime reads the cached capability state consistently; no repeated native inspection. | Integration |
| EP-11 | DI registration / app bootstrap | Service constructed with stored capability config | Runtime is created with the correct selected backend based on persisted capability. | Integration |
| EP-12 | Local fallback path | Native module unavailable | Local deterministic model remains the active behavior and embeddings still execute successfully. | Integration |

---

## Gate for Phase 2

Please review this blueprint. If it matches the approved architecture and acceptance criteria, I will proceed to Phase 2 and generate the additive contracts and red test cases.
