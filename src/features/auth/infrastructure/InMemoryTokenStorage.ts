import { ITokenStorage, TokenBundle } from './ITokenStorage.ts';

/**
 * In-memory implementation of ITokenStorage for use in unit tests.
 * Never persists to disk — data is cleared on every instantiation.
 */
export class InMemoryTokenStorage implements ITokenStorage {
  private bundle: TokenBundle | null = null;

  async store(bundle: TokenBundle): Promise<void> {
    this.bundle = bundle;
  }

  async retrieve(): Promise<TokenBundle | null> {
    return this.bundle;
  }

  async clear(): Promise<void> {
    this.bundle = null;
  }
}
