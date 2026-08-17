import { LoginUseCase } from '../../../src/app/auth/usecases/LoginUseCase';
import { IAuthService } from '../../../src/shared/domain/services/IAuthService';
import { AuthUser, AuthState } from '../../../src/shared/domain/entities/AuthUser';

function makeAuthUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    isAnonymous: false,
    ...overrides,
  };
}

function makeStubAuthService(overrides: Partial<IAuthService> = {}): IAuthService {
  return {
    login: jest.fn().mockResolvedValue(makeAuthUser()),
    logout: jest.fn().mockResolvedValue(undefined),
    getAuthState: jest.fn().mockResolvedValue({ status: 'anonymous' } as AuthState),
    getAccessToken: jest.fn().mockResolvedValue('access-token'),
    isAuthenticated: jest.fn().mockReturnValue(false),
    ...overrides,
  };
}

describe('LoginUseCase', () => {
  it('delegates to IAuthService.login() and returns the AuthUser', async () => {
    const user = makeAuthUser();
    const authService = makeStubAuthService({ login: jest.fn().mockResolvedValue(user) });
    const uc = new LoginUseCase(authService);

    const result = await uc.execute();

    expect(authService.login).toHaveBeenCalledTimes(1);
    expect(result).toBe(user);
  });

  it('propagates rejection from IAuthService.login()', async () => {
    const error = new Error('User cancelled');
    const authService = makeStubAuthService({ login: jest.fn().mockRejectedValue(error) });
    const uc = new LoginUseCase(authService);

    await expect(uc.execute()).rejects.toThrow('User cancelled');
  });
});
