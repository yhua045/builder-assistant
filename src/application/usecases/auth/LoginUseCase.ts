import { IAuthService } from '../../../domain/services/IAuthService';
import { AuthUser } from '../../../domain/entities/AuthUser';

export class LoginUseCase {
  constructor(private readonly authService: IAuthService) {}

  execute(): Promise<AuthUser> {
    return this.authService.login();
  }
}
