import { IAuthService } from '../../../domain/services/IAuthService';
import { AuthState } from '../../../domain/entities/AuthUser';

export class GetAuthStateUseCase {
  constructor(private readonly authService: IAuthService) {}

  execute(): Promise<AuthState> {
    return this.authService.getAuthState();
  }
}
