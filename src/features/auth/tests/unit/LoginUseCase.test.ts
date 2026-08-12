import { LoginUseCase } from '../../../../application/usecases/auth/LoginUseCase';
import { IAuthService } from '../../../../domain/services/IAuthService';
import { AuthUser } from '../../../../domain/entities/AuthUser';

const mockUser: AuthUser = {
  id: 'user-123',
  email: 'user@example.com',
  name: 'Test User',
  isAnonymous: false,
};

function makeAuthService(overrides: Partial<IAuthService> = {}): IAuthService {
  return {
    login: jest.fn().mockResolvedValue(mockUser),
    logout: jest.fn().mockResolvedValue(undefined),
    getAuthState: jest.fn().mockResolvedValue({ status: 'anonymous' }),
    getAccessToken: jest.fn().mockResolvedValue('token'),
    isAuthenticated: jest.fn().mockReturnValue(false),
    ...overrides,
  };
}

describe('LoginUseCase', () => {
  it('delegates to IAuthService.login() and returns AuthUser', async () => {
    const authService = makeAuthService();
    const useCase = new LoginUseCase(authService);

    const result = await useCase.execute();

    expect(authService.login).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockUser);
  });

  it('propagates rejection from IAuthService.login()', async () => {
    const error = new Error('User cancelled');
    const authService = makeAuthService({
      login: jest.fn().mockRejectedValue(error),
    });
    const useCase = new LoginUseCase(authService);

    await expect(useCase.execute()).rejects.toThrow('User cancelled');
  });
});
