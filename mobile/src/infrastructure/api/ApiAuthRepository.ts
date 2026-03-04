import { IAuthRepository, AuthResult } from "../../domain/ports/IAuthRepository";
import { ITokenStorage } from "../../domain/ports/ITokenStorage";
import { UserPublic } from "../../domain/models/User";
import { AuthResponse, LoginRequest, RegisterRequest } from "../../application/dto/AuthDTO";
import { IHttpClient } from "../../domain/ports/IHttpClient";

export class ApiAuthRepository implements IAuthRepository {
  constructor(
    private readonly httpClient: IHttpClient,
    private readonly tokenStorage: ITokenStorage
  ) {}

  async login(email: string, password: string): Promise<AuthResult> {
    const body: LoginRequest = { email, password };
    const response = await this.httpClient.post<AuthResponse>("/api/auth/login", body);

    if (!response.token) {
      throw new Error("No se recibió token del servidor");
    }

    await this.tokenStorage.setToken(response.token);

    return { user: response.user, token: response.token };
  }

  async register(name: string, email: string, password: string): Promise<AuthResult> {
    const body: RegisterRequest = { name, email, password };
    const response = await this.httpClient.post<AuthResponse>("/api/auth/register", body);

    if (!response.token) {
      throw new Error("No se recibió token del servidor");
    }

    await this.tokenStorage.setToken(response.token);

    return { user: response.user, token: response.token };
  }

  async logout(): Promise<void> {
    try {
      await this.httpClient.post("/api/auth/logout");
    } catch {
      // Best effort - clear token even if server call fails
    }
    await this.tokenStorage.removeToken();
  }

  async getMe(): Promise<UserPublic | null> {
    try {
      const response = await this.httpClient.get<{ user: UserPublic }>("/api/auth/me");
      return response.user;
    } catch {
      return null;
    }
  }
}
