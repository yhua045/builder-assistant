import { GetAuthStateUseCase } from '../../../../app/auth/usecases/GetAuthStateUseCase';
import { IAuthService } from '../../../../shared/domain/services/IAuthService';
import { AuthState } from '../../../../shared/domain/entities/AuthUser';

function makeAuthService(state: AuthState): IAuthService {
  return {
    login: jest.fn(),
    logout: jest.fn(),
    getAuthState: jest.fn().mockResolvedValue(state),
    getAccessToken: jest.fn(),
    isAuthenticated: jest.fn(),
  };
}

describe('GetAuthStateUseCase', () => {
  it('returns anonymous state when not authenticated', async () => {
    const state: AuthState = { status: 'anonymous' };
    const useCase = new GetAuthStateUseCase(makeAuthService(state));

    const result = await useCase.execute();

    expect(result).toEqual({ status: 'anonymous' });
    expect(useCase['authService'].getAuthState).toHaveBeenCalledTimes(1);
  });

  it('returns authenticated state with full AuthUser', async () => {
    const state: AuthState = {
      status: 'authenticated',
      user: { id: 'u1', email: 'alice@example.com', name: 'Alice', isAnonymous: false },
    };
    const useCase = new GetAuthStateUseCase(makeAuthService(state));

    const result = await useCase.execute();

    expect(result).toEqual(state);
    expect((result as Extract<AuthState, { status: 'authenticated' }>).user.email).toBe(
      'alice@example.com',
    );
  });
});
