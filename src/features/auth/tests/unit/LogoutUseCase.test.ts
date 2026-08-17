import { LogoutUseCase } from '../../../../app/auth/usecases/LogoutUseCase';
import { IAuthService } from '../../../../shared/domain/services/IAuthService';

function makeAuthService(overrides: Partial<IAuthService> = {}): IAuthService {
  return {
    login: jest.fn().mockResolvedValue(undefined),
    logout: jest.fn().mockResolvedValue(undefined),
    getAuthState: jest.fn().mockResolvedValue({ status: 'anonymous' }),
    getAccessToken: jest.fn().mockResolvedValue('token'),
    isAuthenticated: jest.fn().mockReturnValue(false),
    ...overrides,
  };
}

describe('LogoutUseCase', () => {
  it('delegates to IAuthService.logout() and resolves void', async () => {
    const authService = makeAuthService();
    const useCase = new LogoutUseCase(authService);

    const result = await useCase.execute();

    expect(authService.logout).toHaveBeenCalledTimes(1);
    expect(result).toBeUndefined();
  });

  it('propagates rejection from IAuthService.logout()', async () => {
    const error = new Error('Network error');
    const authService = makeAuthService({
      logout: jest.fn().mockRejectedValue(error),
    });
    const useCase = new LogoutUseCase(authService);

    await expect(useCase.execute()).rejects.toThrow('Network error');
  });
});
