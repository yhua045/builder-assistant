import React, { createContext, useCallback, useEffect, useState } from 'react';
import { AuthState } from '../../../shared/domain/entities/AuthUser';
import { LoginUseCase } from '../../../app/auth/usecases/LoginUseCase';
import { LogoutUseCase } from '../../../app/auth/usecases/LogoutUseCase';
import { GetAuthStateUseCase } from '../../../app/auth/usecases/GetAuthStateUseCase';
import { IAuthService } from '../../../shared/domain/services/IAuthService';

export interface AuthContextValue {
  authState: AuthState;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const DEFAULT_STATE: AuthContextValue = {
  authState: { status: 'anonymous' },
  isLoading: true,
  login: async () => {},
  logout: async () => {},
};

export const AuthContext = createContext<AuthContextValue>(DEFAULT_STATE);

interface AuthProviderProps {
  children: React.ReactNode;
  /** Injected IAuthService — resolved from DI container by the app root. */
  authService: IAuthService;
}

/**
 * Wraps the app with authentication state. Places the current AuthState in
 * context, exposes login/logout actions, and restores sessions silently on
 * mount via GetAuthStateUseCase.
 *
 * Place this provider as close to the app root as possible (e.g., in
 * App.tsx / _layout.tsx), wrapping all screens that may need auth state.
 */
export function AuthProvider({ children, authService }: AuthProviderProps): React.ReactElement {
  const [authState, setAuthState] = useState<AuthState>({ status: 'anonymous' });
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount (silent token refresh if tokens are stored).
  useEffect(() => {
    const getAuthState = new GetAuthStateUseCase(authService);
    getAuthState
      .execute()
      .then(setAuthState)
      .catch(() => setAuthState({ status: 'anonymous' }))
      .finally(() => setIsLoading(false));
  }, [authService]);

  const login = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const loginUseCase = new LoginUseCase(authService);
      const user = await loginUseCase.execute();
      setAuthState({ status: 'authenticated', user });
    } finally {
      setIsLoading(false);
    }
  }, [authService]);

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const logoutUseCase = new LogoutUseCase(authService);
      await logoutUseCase.execute();
      setAuthState({ status: 'anonymous' });
    } finally {
      setIsLoading(false);
    }
  }, [authService]);

  return (
    <AuthContext.Provider value={{ authState, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
