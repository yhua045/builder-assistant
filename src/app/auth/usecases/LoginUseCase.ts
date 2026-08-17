import { IAuthService } from '../../../shared/domain/services/IAuthService';
import { AuthUser } from '../../../shared/domain/entities/AuthUser';

export class LoginUseCase {
  constructor(private readonly authService: IAuthService) {}

  execute(): Promise<AuthUser> {
    return this.authService.login();
  }
}
