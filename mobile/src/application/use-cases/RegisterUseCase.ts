import { IAuthRepository, AuthResult } from "../../domain/ports/IAuthRepository";
import { Password } from "../../domain/models/Password";

export class RegisterUseCase {
  constructor(private readonly authRepository: IAuthRepository) {}

  async execute(name: string, email: string, password: string): Promise<AuthResult> {
    if (!name?.trim()) {
      throw new Error("El nombre es obligatorio");
    }
    if (!email?.trim()) {
      throw new Error("El email es obligatorio");
    }
    const passwordErrors = Password.validate(password);
    if (passwordErrors.length > 0) {
      throw new Error(passwordErrors[0]);
    }

    return this.authRepository.register(name.trim(), email.trim().toLowerCase(), password);
  }
}
