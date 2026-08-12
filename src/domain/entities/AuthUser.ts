export interface AuthUser {
  readonly id: string;        // subject claim from JWT
  readonly email: string | null;
  readonly name: string | null;
  readonly isAnonymous: false;
}

export type AuthState =
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: AuthUser };
