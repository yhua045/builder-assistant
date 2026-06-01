import * as Keychain from 'react-native-keychain';
import { ITokenStorage, TokenBundle } from './ITokenStorage';

const SERVICE_NAME = 'builder-assistant-auth';

/**
 * Production token storage backed by the device Keychain (iOS Secure Enclave /
 * Android Keystore). Tokens are serialized as JSON and stored under a dedicated
 * service name so they survive app updates but are cleared on reinstall.
 *
 * OWASP A02 — tokens never written to AsyncStorage or logs.
 */
export class KeychainTokenStorage implements ITokenStorage {
  async store(bundle: TokenBundle): Promise<void> {
    await Keychain.setGenericPassword(
      'auth',
      JSON.stringify(bundle),
      { service: SERVICE_NAME },
    );
  }

  async retrieve(): Promise<TokenBundle | null> {
    const credentials = await Keychain.getGenericPassword({ service: SERVICE_NAME });
    if (!credentials) {
      return null;
    }
    return JSON.parse(credentials.password) as TokenBundle;
  }

  async clear(): Promise<void> {
    await Keychain.resetGenericPassword({ service: SERVICE_NAME });
  }
}
