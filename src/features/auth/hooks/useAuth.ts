import { useContext } from 'react';
import { AuthContext, AuthContextValue } from '../context/AuthContext';

/**
 * Returns the current auth context value.
 * Must be used within an <AuthProvider> — throws if the provider is missing.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
