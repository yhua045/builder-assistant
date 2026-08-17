import { AuthUser, AuthState } from '../entities/AuthUser.ts';

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
