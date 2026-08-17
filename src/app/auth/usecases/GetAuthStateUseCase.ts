import { IAuthService } from '../../../shared/domain/services/IAuthService';
import { AuthState } from '../../../shared/domain/entities/AuthUser';

export class GetAuthStateUseCase {
  constructor(private readonly authService: IAuthService) {}

  execute(): Promise<AuthState> {
    return this.authService.getAuthState();
  }
}
