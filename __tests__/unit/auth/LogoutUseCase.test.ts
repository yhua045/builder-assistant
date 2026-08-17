import { LogoutUseCase } from '../../../src/app/auth/usecases/LogoutUseCase';
import { IAuthService } from '../../../src/shared/domain/services/IAuthService';
import { AuthState } from '../../../src/shared/domain/entities/AuthUser';

function makeStubAuthService(overrides: Partial<IAuthService> = {}): IAuthService {
  return {
    login: jest.fn(),
    logout: jest.fn().mockResolvedValue(undefined),
    getAuthState: jest.fn().mockResolvedValue({ status: 'anonymous' } as AuthState),
    getAccessToken: jest.fn(),
    isAuthenticated: jest.fn().mockReturnValue(false),
    ...overrides,
  };
}

describe('LogoutUseCase', () => {
  it('calls IAuthService.logout() exactly once', async () => {
    const authService = makeStubAuthService();
    const uc = new LogoutUseCase(authService);

    await uc.execute();

    expect(authService.logout).toHaveBeenCalledTimes(1);
  });

  it('resolves to void on success', async () => {
    const authService = makeStubAuthService();
    const uc = new LogoutUseCase(authService);

    const result = await uc.execute();

    expect(result).toBeUndefined();
  });

  it('propagates rejection from IAuthService.logout()', async () => {
    const error = new Error('Keychain unavailable');
    const authService = makeStubAuthService({ logout: jest.fn().mockRejectedValue(error) });
    const uc = new LogoutUseCase(authService);

    await expect(uc.execute()).rejects.toThrow('Keychain unavailable');
  });
});
