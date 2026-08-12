# Design: Issue #226 — Optional Login + Centralized Auth + Feature-Gating for Premium OCR

**Status**: DRAFT — awaiting mobile-ui review (§8) and stakeholder approval  
**Author**: Copilot (architect mode)  
**Date**: 2026-06-01  
**GitHub Issue**: #226  
**Branch**: `issue-226-optional-login-auth` (to be created)

---

## 1. Summary

Introduce an **optional, zero-friction login** flow backed by a centralized `AuthService` using
OAuth 2.0 Authorization Code + PKCE. Anonymous users continue to use the full app uninterrupted;
authenticated users unlock **premium backend OCR** (cloud-based, higher accuracy) in place of the
existing on-device ML Kit pipeline.

This is a **non-breaking additive change**. No existing screen or flow is removed or gated.

---

## 2. User Stories & Acceptance Criteria

### US-1 — Anonymous-first usage
> As a user who has not signed in, I can use all existing app features (projects, tasks,
> payments, receipts) without interruption. On-device ML Kit OCR continues to work.

**AC:**
- [ ] App launches with zero auth prompts.
- [ ] All existing screens render and function identically when unauthenticated.
- [ ] `MobileOcrAdapter` falls back to ML Kit when `IAuthService.isAuthenticated()` returns `false`.

### US-2 — Optional sign-in
> As a user, I can tap a "Sign In" button (visible in the Profile tab) to authenticate via my
> provider using a browser-based OAuth PKCE flow.

**AC:**
- [ ] A `LoginButton` is present on the Profile screen when unauthenticated.
- [ ] Tapping triggers the OAuth PKCE flow via `react-native-app-auth`.
- [ ] On success: token stored in Keychain, `AuthUser` available globally via `AuthContext`.
- [ ] On cancellation or error: user stays anonymous, error shown as a non-blocking toast.

### US-3 — Premium OCR feature gate
> As an authenticated user who scans a receipt, the app calls the premium backend OCR endpoint
> instead of on-device ML Kit, returning richer, more accurate results.

**AC:**
- [ ] `OcrAdapterFactory` returns `ApiOcrAdapter` when `IAuthService.isAuthenticated()` is `true`, `MlKitOcrAdapter` otherwise.
- [ ] `ApiOcrAdapter` injects a Bearer token via `IAuthService.getAccessToken()` before each call.
- [ ] Token expiry triggers a silent refresh before the call; factory-level fallback demotes to `MlKitOcrAdapter` with a logged warning.
- [ ] No visible change in the receipt scan UX — same `OcrResult` shape returned by both adapters.

### US-4 — Sign-out
> As an authenticated user, I can sign out from the Profile tab. Post sign-out I revert to
> anonymous mode (local OCR).

**AC:**
- [ ] A "Sign Out" option is shown in the Profile screen Account section when authenticated.
- [ ] Sign-out clears Keychain tokens and resets `AuthContext` to anonymous.
- [ ] Next OCR call uses local ML Kit.

### US-5 — Persistent session
> As an authenticated user who restarts the app, my session is restored without re-authenticating
> (until the refresh token expires or I sign out).

**AC:**
- [ ] On app launch, `AuthService` reads tokens from Keychain and validates / silently refreshes.
- [ ] If refresh fails (revoked / expired), user is silently demoted to anonymous.

---

## 3. Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│  React UI Layer                                                            │
│  AuthContext (React.createContext)                                         │
│  ├── LoginButton (Profile tab)                                             │
│  └── LoginModal (optional bottom-sheet trigger)                           │
│       └── useAuth hook ──────────────────────────────────────┐            │
└─────────────────────────────────────────────────────────────┼────────────┘
                                                              │
┌────────────────────────────────────────────────────────────┼────────────┐
│  Application Layer (Use Cases)                             │            │
│  ├── LoginUseCase                                          │            │
│  ├── LogoutUseCase                                         ▼            │
│  └── GetAuthStateUseCase                         IAuthService (port)    │
└───────────────────────────────────────────────────────────┼────────────┘
                                                            │
┌───────────────────────────────────────────────────────────┼────────────┐
│  Infrastructure Layer                                      │            │
│  ├── ReactNativeAppAuthService ◄──────────────────────────┘            │
│  │   (react-native-app-auth, OAuth PKCE)                               │
│  ├── ITokenStorage (port)                                               │
│  │   └── KeychainTokenStorage (react-native-keychain)                  │
│  ├── MlKitOcrAdapter (implements IOcrAdapter)                            │
│  │   └── translates image URI → ML Kit request → OcrResult             │
│  ├── ApiOcrAdapter (implements IOcrAdapter)                             │
│  │   └── translates image URI → HTTP multipart request → OcrResult     │
│  │       (injects Bearer token via IAuthService)                        │
│  └── OcrAdapterFactory                                                  │
│       ├── isAuthenticated() → returns ApiOcrAdapter                    │
│       └── else → returns MlKitOcrAdapter                               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Detailed Layer Design

### 4.1 Domain Layer

**New file: `src/domain/entities/AuthUser.ts`**
```typescript
export interface AuthUser {
  readonly id: string;           // subject claim from JWT
  readonly email: string | null;
  readonly name: string | null;
  readonly isAnonymous: false;
}

export type AuthState =
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: AuthUser };
```

**New file: `src/domain/services/IAuthService.ts`**
```typescript
export interface IAuthService {
  /**
   * Attempt OAuth PKCE login. Resolves with the authenticated user.
   * Rejects if the user cancels or the flow errors.
   */
  login(): Promise<AuthUser>;

  /** Clear stored tokens and demote to anonymous. */
  logout(): Promise<void>;

  /** Returns current auth state. Does NOT block on network. */
  getAuthState(): Promise<AuthState>;

  /**
   * Returns a valid access token, refreshing silently if needed.
   * Rejects if refresh fails (caller should handle gracefully).
   */
  getAccessToken(): Promise<string>;

  /** Synchronous check — returns `false` if not yet loaded. */
  isAuthenticated(): boolean;
}
```

### 4.2 Application Layer

All files under `src/application/usecases/auth/`:

| Use Case | Inputs | Output | Notes |
|---|---|---|---|
| `LoginUseCase` | — | `AuthUser` | Delegates to `IAuthService.login()` |
| `LogoutUseCase` | — | `void` | Calls `IAuthService.logout()` |
| `GetAuthStateUseCase` | — | `AuthState` | Reads from `IAuthService.getAuthState()` |

Each use case accepts `IAuthService` via constructor injection.

### 4.3 Infrastructure Layer — Auth

#### 4.3.1 Token Storage Port

**New file: `src/infrastructure/auth/ITokenStorage.ts`**
```typescript
export interface TokenBundle {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix ms
  idToken?: string;
}

export interface ITokenStorage {
  store(bundle: TokenBundle): Promise<void>;
  retrieve(): Promise<TokenBundle | null>;
  clear(): Promise<void>;
}
```

#### 4.3.2 Keychain Storage (production)

**New file: `src/infrastructure/auth/KeychainTokenStorage.ts`**

- Uses `react-native-keychain` (`setGenericPassword` / `getGenericPassword` / `resetGenericPassword`).
- Service name: `'builder-assistant-auth'`.
- Tokens serialized as JSON.
- OWASP: no sensitive data in AsyncStorage; Keychain is encrypted at-rest (iOS Secure Enclave / Android Keystore).

#### 4.3.3 OAuth PKCE Service

**New file: `src/infrastructure/auth/ReactNativeAppAuthService.ts`**

- Wraps `react-native-app-auth` (`authorize`, `refresh`).
- Config injected via constructor (issuer, clientId, redirectUrl, scopes) — **never hard-coded**.
- On `login()`:
  1. Call `authorize(config)` → `AuthorizationResponse`.
  2. Store `TokenBundle` via `ITokenStorage`.
  3. Return `AuthUser` parsed from `idToken`/`userinfo`.
- On `getAccessToken()`:
  1. Load bundle from storage.
  2. If expired (within 60 s buffer), call `refresh(config, { refreshToken })`.
  3. Update storage, return new access token.
- On `logout()`: call `ITokenStorage.clear()`.
- OAuth config values loaded from `@env` (react-native-dotenv): `AUTH_ISSUER`, `AUTH_CLIENT_ID`, `AUTH_REDIRECT_URL`, `AUTH_SCOPES`.

**PKCE security**: `react-native-app-auth` generates the `code_verifier` / `code_challenge` pair natively — no manual crypto required.

### 4.4 OCR Adapter Redesign — Translator + Factory Pattern

Each adapter is a **pure translator**: it only knows how to convert a domain image URI into an
`OcrResult` using its own transport. Routing between adapters is the sole responsibility of
`OcrAdapterFactory`.

#### 4.4.1 `MlKitOcrAdapter.ts` (renamed from `MobileOcrAdapter`)

```typescript
/**
 * Translates an image URI into an OcrResult using on-device ML Kit.
 * No auth dependency — always available.
 */
export class MlKitOcrAdapter implements IOcrAdapter {
  async extractText(imageUri: string): Promise<OcrResult> {
    if (!imageUri) throw new Error('Invalid image URI');
    // existing ML Kit implementation — unchanged, moved verbatim from MobileOcrAdapter
    // translate raw ML Kit blocks → OcrResult shape
  }
}
```

- Pure translator: ML Kit request format in → `OcrResult` domain shape out.
- No auth, no network, no routing logic.

#### 4.4.2 `ApiOcrAdapter.ts`

```typescript
/**
 * Translates an image URI into an OcrResult via the premium backend OCR endpoint.
 * Responsible only for the HTTP translation; does NOT fall back to ML Kit.
 */
export class ApiOcrAdapter implements IOcrAdapter {
  constructor(private readonly authService: IAuthService) {}

  async extractText(imageUri: string): Promise<OcrResult> {
    if (!imageUri) throw new Error('Invalid image URI');
    const token = await this.authService.getAccessToken(); // silent refresh included
    // POST imageUri to PREMIUM_OCR_ENDPOINT (env-configured)
    // translate HTTP response JSON → OcrResult domain shape
    // throws on network or HTTP error — caller (factory) handles fallback
  }
}
```

- Pure translator: image URI + Bearer token → HTTP multipart POST → `OcrResult`.
- `PREMIUM_OCR_ENDPOINT` loaded from `@env`.
- Throws on any failure; does NOT internally fall back (that is the factory's responsibility).

#### 4.4.3 `OcrAdapterFactory.ts`

```typescript
/**
 * Selects and returns the appropriate IOcrAdapter based on current auth state.
 * Also owns the graceful-degradation policy when the API adapter fails.
 */
export class OcrAdapterFactory {
  constructor(
    private readonly authService: IAuthService,
    private readonly mlKitAdapter: MlKitOcrAdapter,
    private readonly apiAdapter: ApiOcrAdapter,
  ) {}

  /**
   * Returns an IOcrAdapter whose extractText() is ready to call.
   * When authenticated and premiumOcr flag is enabled, returns a wrapped
   * ApiOcrAdapter that falls back to MlKitOcrAdapter on any error.
   */
  getAdapter(): IOcrAdapter {
    if (!FeatureFlags.premiumOcr || !this.authService.isAuthenticated()) {
      return this.mlKitAdapter;
    }

    // Decorator: try API, degrade to ML Kit on any failure
    return {
      extractText: async (imageUri: string): Promise<OcrResult> => {
        try {
          return await this.apiAdapter.extractText(imageUri);
        } catch (err) {
          console.warn('[OcrAdapterFactory] API OCR failed, degrading to ML Kit:', err);
          return this.mlKitAdapter.extractText(imageUri);
        }
      },
    };
  }
}
```

- Single responsibility: **routing + degradation policy only**.
- `MlKitOcrAdapter` and `ApiOcrAdapter` remain unaware of each other.
- The degradation decorator is created inline — avoids an extra class while keeping adapters pure.
- Consumers (use cases, hooks) call `factory.getAdapter().extractText(uri)` and never need to
  know which adapter was chosen.

### 4.5 DI Registration

`src/infrastructure/di/registerServices.ts` additions:
```typescript
container.registerSingleton('ITokenStorage', KeychainTokenStorage);
container.registerSingleton('IAuthService', ReactNativeAppAuthService);
container.registerSingleton('MlKitOcrAdapter', MlKitOcrAdapter);
container.registerSingleton('ApiOcrAdapter', ApiOcrAdapter);   // injects IAuthService
container.registerSingleton('OcrAdapterFactory', OcrAdapterFactory); // injects all three above
```

Existing consumers that previously resolved `MobileOcrAdapter` now resolve `OcrAdapterFactory`
and call `.getAdapter()` before each OCR operation.

### 4.6 Feature Flag

Add to `src/infrastructure/config/featureFlags.ts`:
```typescript
/**
 * When true AND the user is authenticated, MobileOcrAdapter routes
 * to the premium backend OCR endpoint instead of local ML Kit.
 */
premiumOcr: (process?.env?.FEATURE_PREMIUM_OCR ?? '') === 'true',
```

The `MobileOcrAdapter` checks `FeatureFlags.premiumOcr && authService?.isAuthenticated()`.

---

## 5. React Context & Hook

### 5.1 `AuthContext`

**New file: `src/features/auth/context/AuthContext.tsx`**

```typescript
interface AuthContextValue {
  authState: AuthState;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

export const AuthContext = React.createContext<AuthContextValue>(/* ... */);
export function AuthProvider({ children }: { children: React.ReactNode }): JSX.Element;
```

- Wraps `LoginUseCase` / `LogoutUseCase` / `GetAuthStateUseCase`.
- Resolves `IAuthService` from the DI container.
- Initializes auth state on mount (silent token restore).
- Placed at the root of the app (e.g., `_layout.tsx` / `App.tsx`).

### 5.2 `useAuth` Hook

**New file: `src/features/auth/hooks/useAuth.ts`**

```typescript
export function useAuth(): AuthContextValue;
```

- Simple `useContext(AuthContext)` wrapper with a guard for missing provider.
- Used by `LoginButton`, `LoginModal`, and the Profile screen.

---

## 6. File Map

```
src/
├── domain/
│   ├── entities/
│   │   └── AuthUser.ts                          NEW
│   └── services/
│       └── IAuthService.ts                      NEW
├── application/
│   └── usecases/auth/
│       ├── LoginUseCase.ts                      NEW
│       ├── LogoutUseCase.ts                     NEW
│       └── GetAuthStateUseCase.ts               NEW
├── infrastructure/
│   └── auth/
│       ├── ITokenStorage.ts                     NEW
│       ├── KeychainTokenStorage.ts              NEW
│       ├── InMemoryTokenStorage.ts              NEW (test double)
│       └── ReactNativeAppAuthService.ts         NEW
│   └── ocr/
│       ├── MlKitOcrAdapter.ts                   RENAMED (was MobileOcrAdapter; pure ML Kit translator)
│       ├── ApiOcrAdapter.ts                      NEW (pure API translator)
│       └── OcrAdapterFactory.ts                  NEW (routing + degradation policy)
│   └── config/
│       └── featureFlags.ts                      UPDATED (premiumOcr flag)
│   └── di/
│       └── registerServices.ts                  UPDATED (auth service wiring)
└── features/
    └── auth/
        ├── context/
        │   └── AuthContext.tsx                  NEW
        ├── components/
        │   ├── LoginButton.tsx                  NEW
        │   └── LoginModal.tsx                   NEW
        ├── hooks/
        │   └── useAuth.ts                       NEW
        └── tests/
            ├── unit/
            │   ├── LoginUseCase.test.ts              NEW
            │   ├── LogoutUseCase.test.ts             NEW
            │   ├── GetAuthStateUseCase.test.ts       NEW
            │   ├── MlKitOcrAdapter.test.ts           NEW (pure translation, no auth mock needed)
            │   ├── ApiOcrAdapter.test.ts             NEW (mocked IAuthService + HTTP client)
            │   └── OcrAdapterFactory.test.ts         NEW (routing + fallback scenarios)
            └── integration/
                └── KeychainTokenStorage.integration.test.ts NEW
```

---

## 7. New Dependencies

| Package | Version | Purpose | Install |
|---|---|---|---|
| `react-native-app-auth` | `^7.x` | OAuth 2.0 PKCE flow (browser-based) | `npm install react-native-app-auth` + pod install |
| `react-native-keychain` | `^9.x` | Secure token storage (Keychain / Keystore) | `npm install react-native-keychain` + pod install |

**No Expo dependencies** — this is a bare React Native 0.81 project.

Both libraries require native linking. iOS: `cd ios && pod install`. Android: auto-linked.

---

## 8. UI Design (mobile-ui agent review required)

> ⚠️ **mobile-ui agent**: Please review this section for alignment with existing layout
> patterns, NativeWind token usage, and screen-level consistency before implementation begins.

### 8.1 `LoginButton` — Profile Tab (unauthenticated state)

**Placement**: Profile screen, new "Account" section above the Settings section.

**Unauthenticated rendering:**
```
┌────────────────────────────────────────────┐
│  🔑  Sign In to unlock premium features    │  ▸
│      Fast, accurate cloud OCR              │
└────────────────────────────────────────────┘
```

- NativeWind classes: `bg-primary/10 rounded-xl p-4 flex-row items-center mb-3`
- Icon: `LogIn` from `lucide-react-native` with `className="text-primary"`
- Label: `text-foreground font-medium`; subtitle: `text-muted-foreground text-sm`
- Right-side chevron (`ChevronRight`) — matches `MenuItem` pattern in `ProfileScreen`.
- Pressing opens `LoginModal`.

**Authenticated rendering** (replaces `LoginButton`):
```
┌──────────────────────────────────────────────┐
│  👤  sarah.mitchell@constructco.com           │
│      Premium features active                  │
├──────────────────────────────────────────────┤
│  🚪  Sign Out                                 │
└──────────────────────────────────────────────┘
```

- User email from `AuthUser.email` (`text-muted-foreground text-sm`).
- "Premium features active" badge: `bg-green-500/10 text-green-600 text-xs px-2 py-0.5 rounded-full`.
- Sign Out row: `text-destructive font-medium` with `LogOut` icon.

### 8.2 `LoginModal` — Bottom Sheet

**Trigger**: `LoginButton` press (unauthenticated).

**Layout (bottom sheet, `~50%` height):**
```
┌─────────────────────────────────────────────┐
│  ◻◻◻  (drag handle)                         │
│                                              │
│   🏗️  OwnerBuilder Premium                  │
│   Sign in to unlock:                         │
│   • ✓ High-accuracy cloud OCR               │
│   • ✓ Faster receipt scanning               │
│   • ✓ More coming soon...                   │
│                                              │
│   ┌─────────────────────────────────────┐   │
│   │   Sign In with [Provider]           │   │
│   └─────────────────────────────────────┘   │
│                                              │
│   Continue without signing in               │
└─────────────────────────────────────────────┘
```

- Uses `Modal` (React Native core, same as existing modals in the project) with `presentationStyle="pageSheet"` on iOS.
- Primary button: `bg-primary rounded-xl p-4 items-center` — `Sign In with [Provider]`.
- Secondary link: `text-muted-foreground text-center text-sm` — "Continue without signing in" (closes modal).
- Loading state: `ActivityIndicator` replaces button text.
- Error state: `text-destructive text-sm text-center mt-2`.
- Font: `Inter` (existing `themeFonts.body`).
- Colours: all standard `--primary`, `--background`, `--foreground`, `--muted-foreground` tokens.

### 8.3 Premium OCR Badge (SnapReceiptScreen)

When authenticated and `FeatureFlags.premiumOcr` is enabled, show a subtle badge:

```
Extracting receipt details...
☁ Cloud OCR active
```

- `text-xs text-primary/70 mt-1` — non-intrusive subtitle below existing spinner text.
- No structural change to `SnapReceiptScreen`.

---

## 9. Security Considerations (OWASP)

| Risk | Mitigation |
|---|---|
| **A02 — Cryptographic Failures** | Tokens stored in Keychain (iOS Secure Enclave / Android Keystore), never AsyncStorage |
| **A07 — Identification & Authentication Failures** | PKCE (`S256`) prevents authorization code interception; no client secret in mobile app |
| **A02 — Sensitive data exposure** | `AuthUser` carries no raw tokens; access token retrieved on-demand from service |
| **Token leakage in logs** | `getAccessToken()` result never logged; `console.warn` messages redact token |
| **Refresh token abuse** | `react-native-app-auth` uses in-memory PKCE verifier; no verifier persisted |
| **Insecure redirect** | Redirect URL uses custom scheme registered in native manifest — not `http://` |

---

## 10. Test Plan

### 10.1 Unit Tests

| Test file | Scenarios |
|---|---|
| `LoginUseCase.test.ts` | success path, `IAuthService.login()` rejection propagates |
| `LogoutUseCase.test.ts` | calls `IAuthService.logout()`, resolves void |
| `GetAuthStateUseCase.test.ts` | anonymous state, authenticated state |
| `MlKitOcrAdapter.test.ts` | valid URI → translates ML Kit output to `OcrResult`; invalid URI throws |
| `ApiOcrAdapter.test.ts` | calls `IAuthService.getAccessToken()`; sends Bearer token in request; maps response to `OcrResult`; propagates errors (no internal fallback) |
| `OcrAdapterFactory.test.ts` | unauthenticated → returns `MlKitOcrAdapter`; authenticated + flag off → returns `MlKitOcrAdapter`; authenticated + flag on → returns decorated adapter; decorated adapter falls back to ML Kit when `ApiOcrAdapter` throws |

Mock `IAuthService` and `ITokenStorage` via `InMemoryTokenStorage` and hand-written stubs.
`ApiOcrAdapter` tests mock the HTTP client at the fetch/axios boundary.

### 10.2 Integration Tests

| Test file | Scenarios |
|---|---|
| `KeychainTokenStorage.integration.test.ts` | store → retrieve round-trip; clear removes data |

> Note: OAuth PKCE flow (browser round-trip) is NOT unit-tested. Tested manually against a dev
> provider during implementation.

### 10.3 UI / Snapshot Tests

| Component | Scenarios |
|---|---|
| `LoginButton` | unauthenticated snapshot; authenticated snapshot (email + sign-out) |
| `LoginModal` | idle, loading, error state snapshots |

---

## 11. TDD Implementation Sequence

Follow the TDD workflow from `CLAUDE.md §Development Guidelines`:

1. **Domain interfaces first**: `IAuthService`, `AuthUser`, `AuthState` — no test yet, just types.
2. **Use case tests** (red): write `LoginUseCase.test.ts`, `LogoutUseCase.test.ts`, `GetAuthStateUseCase.test.ts` against stub `IAuthService`.
3. **Use case implementation** (green): implement the three use cases.
4. **OCR adapter tests** (red):
   - `MlKitOcrAdapter.test.ts` — pure translation, no auth mock required.
   - `ApiOcrAdapter.test.ts` — mock `IAuthService` + HTTP client; assert no internal fallback.
   - `OcrAdapterFactory.test.ts` — mock `IAuthService`; assert routing + degradation policy.
5. **OCR adapter implementation** (green):
   - Rename `MobileOcrAdapter` → `MlKitOcrAdapter`; strip routing logic.
   - Implement `ApiOcrAdapter` (pure HTTP translator).
   - Implement `OcrAdapterFactory` (routing + inline degradation decorator).
6. **Token storage tests + implementation**: `KeychainTokenStorage.integration.test.ts`.
7. **`ReactNativeAppAuthService`**: implement + manual smoke test with dev provider.
8. **`AuthContext` + `useAuth`**: implement + snapshot test.
9. **`LoginButton` + `LoginModal`**: implement + snapshot test.
10. **Wire DI** + Profile screen integration; update all consumers from `MobileOcrAdapter` → `OcrAdapterFactory`.

---

## 12. Open Questions

- [ ] **OAuth provider**: Which identity provider? (Auth0, Cognito, Azure AD B2C, custom?) → determines `AUTH_ISSUER` and `AUTH_CLIENT_ID` env values. **Do not proceed to step 7 without this answer.**
- [ ] **Premium OCR backend**: Is the endpoint already built? What is the contract (multipart upload? base64 JSON?)? → needed for `extractViaBackend`.
- [ ] **Scopes**: What scopes does the provider expose? (`openid email profile` assumed.)
- [ ] **iOS deployment target**: `react-native-app-auth` requires iOS 11+. Current min target?
- [ ] **Token storage on Android**: Should `react-native-keychain` use `ACCESSIBLE_WHEN_UNLOCKED` or `ACCESSIBLE_ALWAYS_THIS_DEVICE_ONLY`? (Recommend former for background refresh scenarios.)

---

## 13. Handoff Notes for `developer` Agent

- This design doc is the source of truth for implementation.
- Start with step 1 of §11 (TDD sequence).
- All new `.env` variables must be added to `.env.example` with placeholder values.
- Do **not** hard-code `AUTH_CLIENT_ID`, `AUTH_ISSUER`, or `PREMIUM_OCR_ENDPOINT`.
- The open questions in §12 must be resolved before implementing `ReactNativeAppAuthService` and `extractViaBackend` (steps 7 and 4b respectively). Stubs are sufficient for earlier steps.
- When renaming `MobileOcrAdapter` → `MlKitOcrAdapter`, preserve **all** existing ML Kit logic verbatim. Only remove the auth-routing code (which moves to `OcrAdapterFactory`).
- `ApiOcrAdapter` must **not** contain any fallback logic — it throws on failure. All degradation lives in `OcrAdapterFactory`.
- Consumers that previously held a reference to `MobileOcrAdapter` must be updated to hold `OcrAdapterFactory` and call `.getAdapter()` per OCR operation (not once at construction time, so auth state changes are picked up dynamically).
