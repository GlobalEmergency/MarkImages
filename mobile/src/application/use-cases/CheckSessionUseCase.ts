import { IAuthRepository } from "../../domain/ports/IAuthRepository";
import { ITokenStorage } from "../../domain/ports/ITokenStorage";
import { UserPublic } from "../../domain/models/User";

export class CheckSessionUseCase {
  constructor(
    private readonly tokenStorage: ITokenStorage,
    private readonly authRepository: IAuthRepository
  ) {}

  async execute(): Promise<UserPublic | null> {
    const token = await this.tokenStorage.getToken();
    if (!token) return null;

    try {
      return await this.authRepository.getMe();
    } catch (err) {
      // Only clear token on auth errors (401), not on network failures
      const isAuthError =
        err instanceof Error &&
        (err.message.includes("401") || err.message.includes("Sesión expirada"));
      if (isAuthError) {
        await this.tokenStorage.removeToken();
      }
      return null;
    }
  }
}
