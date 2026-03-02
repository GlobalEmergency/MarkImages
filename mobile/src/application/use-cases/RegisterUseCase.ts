import { IAuthRepository, AuthResult } from "../../domain/ports/IAuthRepository";

export class RegisterUseCase {
  constructor(private readonly authRepository: IAuthRepository) {}

  async execute(name: string, email: string, password: string): Promise<AuthResult> {
    if (!name?.trim()) {
      throw new Error("El nombre es obligatorio");
    }
    if (!email?.trim()) {
      throw new Error("El email es obligatorio");
    }
    if (!password || password.length < 8) {
      throw new Error("La contraseña debe tener al menos 8 caracteres");
    }
    if (!/[A-Z]/.test(password)) {
      throw new Error("La contraseña debe incluir al menos una mayúscula");
    }
    if (!/[a-z]/.test(password)) {
      throw new Error("La contraseña debe incluir al menos una minúscula");
    }
    if (!/[0-9]/.test(password)) {
      throw new Error("La contraseña debe incluir al menos un número");
    }

    return this.authRepository.register(name.trim(), email.trim().toLowerCase(), password);
  }
}
