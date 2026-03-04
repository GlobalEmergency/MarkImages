import { describe, it, expect, vi, beforeEach } from "vitest";
import { CheckSessionUseCase } from "../../../application/use-cases/CheckSessionUseCase";
import { IAuthRepository } from "../../../domain/ports/IAuthRepository";
import { ITokenStorage } from "../../../domain/ports/ITokenStorage";
import { UserPublic } from "../../../domain/models/User";

function createMockTokenStorage(overrides: Partial<ITokenStorage> = {}): ITokenStorage {
  return {
    getToken: vi.fn().mockResolvedValue("valid-token"),
    setToken: vi.fn().mockResolvedValue(undefined),
    removeToken: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockAuthRepository(overrides: Partial<IAuthRepository> = {}): IAuthRepository {
  return {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    getMe: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

const fakeUser: UserPublic = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  role: "USER",
  is_active: true,
  is_verified: true,
  created_at: "2026-01-01T00:00:00Z",
  last_login_at: null,
};

describe("CheckSessionUseCase", () => {
  let tokenStorage: ITokenStorage;
  let authRepository: IAuthRepository;
  let useCase: CheckSessionUseCase;

  beforeEach(() => {
    tokenStorage = createMockTokenStorage();
    authRepository = createMockAuthRepository();
    useCase = new CheckSessionUseCase(tokenStorage, authRepository);
  });

  it("returns null when no token is stored", async () => {
    (tokenStorage.getToken as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await useCase.execute();

    expect(result).toBeNull();
    expect(authRepository.getMe).not.toHaveBeenCalled();
  });

  it("returns user data when session is valid", async () => {
    (authRepository.getMe as ReturnType<typeof vi.fn>).mockResolvedValue(fakeUser);

    const result = await useCase.execute();

    expect(result).toEqual(fakeUser);
    expect(tokenStorage.getToken).toHaveBeenCalled();
    expect(authRepository.getMe).toHaveBeenCalled();
    expect(tokenStorage.removeToken).not.toHaveBeenCalled();
  });

  it("clears token and returns null on 401 auth error", async () => {
    (authRepository.getMe as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Request failed with status 401")
    );

    const result = await useCase.execute();

    expect(result).toBeNull();
    expect(tokenStorage.removeToken).toHaveBeenCalled();
  });

  it("clears token and returns null when error message includes 'Sesión expirada'", async () => {
    (authRepository.getMe as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Sesión expirada")
    );

    const result = await useCase.execute();

    expect(result).toBeNull();
    expect(tokenStorage.removeToken).toHaveBeenCalled();
  });

  it("does NOT clear token on network errors (non-auth errors)", async () => {
    (authRepository.getMe as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network error: Failed to fetch")
    );

    const result = await useCase.execute();

    expect(result).toBeNull();
    // Token should NOT be removed for network failures
    expect(tokenStorage.removeToken).not.toHaveBeenCalled();
  });

  it("does NOT clear token when a non-Error is thrown", async () => {
    // e.g. something throws a string
    (authRepository.getMe as ReturnType<typeof vi.fn>).mockRejectedValue("unexpected string error");

    const result = await useCase.execute();

    expect(result).toBeNull();
    // Not an Error instance, so isAuthError is false
    expect(tokenStorage.removeToken).not.toHaveBeenCalled();
  });

  it("distinguishes auth errors from generic server errors", async () => {
    (authRepository.getMe as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Internal server error 500")
    );

    const result = await useCase.execute();

    expect(result).toBeNull();
    expect(tokenStorage.removeToken).not.toHaveBeenCalled();
  });
});
