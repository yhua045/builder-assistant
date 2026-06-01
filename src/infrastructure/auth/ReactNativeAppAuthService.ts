import { authorize, refresh } from 'react-native-app-auth';
import { AUTH_ISSUER, AUTH_CLIENT_ID, AUTH_REDIRECT_URL, AUTH_SCOPES } from '@env';
import { IAuthService } from '../../domain/services/IAuthService';
import { AuthUser, AuthState } from '../../domain/entities/AuthUser';
import { ITokenStorage, TokenBundle } from './ITokenStorage';

/** Buffer (ms) before token expiry to trigger a silent refresh. */
const REFRESH_BUFFER_MS = 60_000;

const oauthConfig = {
  issuer: AUTH_ISSUER ?? '',
  clientId: AUTH_CLIENT_ID ?? '',
  redirectUrl: AUTH_REDIRECT_URL ?? '',
  scopes: (AUTH_SCOPES ?? 'openid email profile').split(' '),
  additionalParameters: {},
};

/**
 * OAuth 2.0 Authorization Code + PKCE implementation backed by
 * `react-native-app-auth`. PKCE verifier/challenge generation is handled
 * natively by the library — no manual crypto required.
 *
 * ⚠️  Requires OAuth provider env vars (`AUTH_ISSUER`, `AUTH_CLIENT_ID`,
 * `AUTH_REDIRECT_URL`, `AUTH_SCOPES`) — see design/#226-optional-login-auth.md §12.
 */
export class ReactNativeAppAuthService implements IAuthService {
  private _isAuthenticated = false;
  private _cachedUser: AuthUser | null = null;

  constructor(private readonly tokenStorage: ITokenStorage) {}

  async login(): Promise<AuthUser> {
    const response = await authorize(oauthConfig);

    const bundle: TokenBundle = {
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
      expiresAt: new Date(response.accessTokenExpirationDate).getTime(),
      idToken: response.idToken ?? undefined,
    };

    await this.tokenStorage.store(bundle);

    const user = this._parseUser(response.idToken ?? null, response.accessToken);
    this._cachedUser = user;
    this._isAuthenticated = true;

    return user;
  }

  async logout(): Promise<void> {
    await this.tokenStorage.clear();
    this._cachedUser = null;
    this._isAuthenticated = false;
  }

  async getAuthState(): Promise<AuthState> {
    const bundle = await this.tokenStorage.retrieve();
    if (!bundle) {
      this._isAuthenticated = false;
      return { status: 'anonymous' };
    }

    // Attempt silent refresh if needed; demote to anonymous on failure.
    try {
      const validBundle = await this._ensureValidToken(bundle);
      const user = this._cachedUser ?? this._parseUser(validBundle.idToken ?? null, validBundle.accessToken);
      this._cachedUser = user;
      this._isAuthenticated = true;
      return { status: 'authenticated', user };
    } catch {
      await this.tokenStorage.clear();
      this._isAuthenticated = false;
      return { status: 'anonymous' };
    }
  }

  async getAccessToken(): Promise<string> {
    const bundle = await this.tokenStorage.retrieve();
    if (!bundle) {
      throw new Error('No stored token — user is not authenticated');
    }
    const validBundle = await this._ensureValidToken(bundle);
    return validBundle.accessToken;
  }

  /** Synchronous — returns cached state; may be stale if called before getAuthState(). */
  isAuthenticated(): boolean {
    return this._isAuthenticated;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async _ensureValidToken(bundle: TokenBundle): Promise<TokenBundle> {
    if (Date.now() < bundle.expiresAt - REFRESH_BUFFER_MS) {
      return bundle;
    }

    const refreshed = await refresh(oauthConfig, { refreshToken: bundle.refreshToken });
    const newBundle: TokenBundle = {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? bundle.refreshToken,
      expiresAt: new Date(refreshed.accessTokenExpirationDate).getTime(),
      idToken: refreshed.idToken ?? bundle.idToken,
    };
    await this.tokenStorage.store(newBundle);
    return newBundle;
  }

  /**
   * Extracts user identity from the idToken (JWT) or falls back to a stub
   * when the provider doesn't issue an idToken. A full JWT decoder is
   * unnecessary here; we only need the subject claim for the domain entity.
   */
  private _parseUser(idToken: string | null, _accessToken: string): AuthUser {
    if (idToken) {
      try {
        const [, payloadB64] = idToken.split('.');
        const payload = JSON.parse(
          Buffer.from(payloadB64, 'base64').toString('utf8'),
        ) as Record<string, string>;

        return {
          id: payload.sub ?? 'unknown',
          email: payload.email ?? null,
          name: payload.name ?? null,
          isAnonymous: false,
        };
      } catch {
        // Fall through to stub
      }
    }

    return { id: 'unknown', email: null, name: null, isAnonymous: false };
  }
}
