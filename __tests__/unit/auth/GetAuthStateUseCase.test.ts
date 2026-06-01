import { GetAuthStateUseCase } from '../../../src/application/usecases/auth/GetAuthStateUseCase';
import { IAuthService } from '../../../src/domain/services/IAuthService';
import { AuthState } from '../../../src/domain/entities/AuthUser';

function makeStubAuthService(overrides: Partial<IAuthService> = {}): IAuthService {
  return {
    login: jest.fn(),
    logout: jest.fn(),
    getAuthState: jest.fn().mockResolvedValue({ status: 'anonymous' } as AuthState),
    getAccessToken: jest.fn(),
    isAuthenticated: jest.fn().mockReturnValue(false),
    ...overrides,
  };
}

describe('GetAuthStateUseCase', () => {
  it('returns anonymous state when unauthenticated', async () => {
    const state: AuthState = { status: 'anonymous' };
    const authService = makeStubAuthService({
      getAuthState: jest.fn().mockResolvedValue(state),
    });
    const uc = new GetAuthStateUseCase(authService);

    const result = await uc.execute();

    expect(authService.getAuthState).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ status: 'anonymous' });
  });

  it('returns authenticated state with user when authenticated', async () => {
    const state: AuthState = {
      status: 'authenticated',
      user: { id: 'u1', email: 'sarah@co.com', name: 'Sarah', isAnonymous: false },
    };
    const authService = makeStubAuthService({
      getAuthState: jest.fn().mockResolvedValue(state),
    });
    const uc = new GetAuthStateUseCase(authService);

    const result = await uc.execute();

    expect(result.status).toBe('authenticated');
    if (result.status === 'authenticated') {
      expect(result.user.email).toBe('sarah@co.com');
    }
  });
});
