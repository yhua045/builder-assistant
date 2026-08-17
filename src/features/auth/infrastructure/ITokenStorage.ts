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
