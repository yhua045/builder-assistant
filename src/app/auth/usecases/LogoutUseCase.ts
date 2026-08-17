import { IAuthService } from '../../../shared/domain/services/IAuthService';

export class LogoutUseCase {
  constructor(private readonly authService: IAuthService) {}

  execute(): Promise<void> {
    return this.authService.logout();
  }
}
