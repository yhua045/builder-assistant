/**
 * Minimal type shims for native modules that are not yet installed as
 * npm packages (react-native-keychain, react-native-app-auth).
 *
 * When the packages are installed (`npm install react-native-keychain
 * react-native-app-auth && cd ios && pod install`), delete these shims —
 * the official @types packages will take over.
 *
 * See design/#226-optional-login-auth.md §7 for install instructions.
 */

// ── react-native-keychain ────────────────────────────────────────────────────

declare module 'react-native-keychain' {
  interface Options {
    service?: string;
    accessible?: string;
  }

  interface Credentials {
    username: string;
    password: string;
    service: string;
  }

  export const ACCESSIBLE: {
    WHEN_UNLOCKED: string;
    ALWAYS_THIS_DEVICE_ONLY: string;
    [key: string]: string;
  };

  export function setGenericPassword(
    username: string,
    password: string,
    options?: Options,
  ): Promise<boolean | { service: string; storage: string }>;

  export function getGenericPassword(
    options?: Options,
  ): Promise<Credentials | false>;

  export function resetGenericPassword(options?: Options): Promise<boolean>;
}

// ── react-native-app-auth ────────────────────────────────────────────────────

declare module 'react-native-app-auth' {
  interface AuthConfiguration {
    issuer?: string;
    serviceConfiguration?: {
      authorizationEndpoint: string;
      tokenEndpoint: string;
      revocationEndpoint?: string;
    };
    clientId: string;
    redirectUrl: string;
    scopes: string[];
    additionalParameters?: Record<string, string>;
  }

  interface AuthorizeResult {
    accessToken: string;
    accessTokenExpirationDate: string;
    idToken: string | null;
    refreshToken: string;
    tokenType: string;
    scopes: string[];
  }

  interface RefreshResult {
    accessToken: string;
    accessTokenExpirationDate: string;
    idToken: string | null;
    refreshToken: string | null;
    tokenType: string;
  }

  interface RefreshOptions {
    refreshToken: string;
  }

  export function authorize(config: AuthConfiguration): Promise<AuthorizeResult>;
  export function refresh(
    config: AuthConfiguration,
    options: RefreshOptions,
  ): Promise<RefreshResult>;
  export function revoke(
    config: AuthConfiguration,
    options: { tokenToRevoke: string; includeBasicAuth?: boolean },
  ): Promise<void>;
}
