import { IAuthRepository, AuthResult } from "../../domain/ports/IAuthRepository";

export class LoginUseCase {
  constructor(private readonly authRepository: IAuthRepository) {}

  async execute(email: string, password: string): Promise<AuthResult> {
    if (!email?.trim()) {
      throw new Error("El email es obligatorio");
    }
    if (!password) {
      throw new Error("La contraseña es obligatoria");
    }

    return this.authRepository.login(email.trim().toLowerCase(), password);
  }
}
