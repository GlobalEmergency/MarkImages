import { describe, it, expect, vi, beforeEach } from "vitest";
import { RegisterUseCase } from "../../../application/use-cases/RegisterUseCase";
import { IAuthRepository, AuthResult } from "../../../domain/ports/IAuthRepository";

function createMockAuthRepository(overrides: Partial<IAuthRepository> = {}): IAuthRepository {
  return {
    login: vi.fn(),
    register: vi.fn().mockResolvedValue({
      user: {
        id: "user-1",
        email: "test@example.com",
        name: "Test",
        role: "USER",
        is_active: true,
        is_verified: false,
        created_at: "2026-01-01T00:00:00Z",
        last_login_at: null,
      },
      token: "jwt-token",
    }),
    logout: vi.fn(),
    getMe: vi.fn(),
    ...overrides,
  };
}

describe("RegisterUseCase", () => {
  let authRepository: IAuthRepository;
  let useCase: RegisterUseCase;

  beforeEach(() => {
    authRepository = createMockAuthRepository();
    useCase = new RegisterUseCase(authRepository);
  });

  // --- Name validation ---

  it("throws for empty name", async () => {
    await expect(useCase.execute("", "test@example.com", "ValidPass1")).rejects.toThrow(
      "El nombre es obligatorio"
    );
  });

  it("throws for whitespace-only name", async () => {
    await expect(useCase.execute("   ", "test@example.com", "ValidPass1")).rejects.toThrow(
      "El nombre es obligatorio"
    );
  });

  it("throws for null name", async () => {
    await expect(
      useCase.execute(null as unknown as string, "test@example.com", "ValidPass1")
    ).rejects.toThrow("El nombre es obligatorio");
  });

  // --- Email validation ---

  it("throws for empty email", async () => {
    await expect(useCase.execute("Test User", "", "ValidPass1")).rejects.toThrow(
      "El email es obligatorio"
    );
  });

  it("throws for whitespace-only email", async () => {
    await expect(useCase.execute("Test User", "   ", "ValidPass1")).rejects.toThrow(
      "El email es obligatorio"
    );
  });

  it("throws for null email", async () => {
    await expect(
      useCase.execute("Test User", null as unknown as string, "ValidPass1")
    ).rejects.toThrow("El email es obligatorio");
  });

  // --- Password validation (delegates to Password VO) ---

  it("throws for invalid password (too short)", async () => {
    await expect(useCase.execute("Test User", "test@example.com", "Ab1")).rejects.toThrow(
      "La contraseña debe tener al menos 8 caracteres"
    );
  });

  it("throws for password missing uppercase", async () => {
    await expect(useCase.execute("Test User", "test@example.com", "abcdefg1")).rejects.toThrow(
      "La contraseña debe incluir al menos una mayúscula"
    );
  });

  it("throws first password error when multiple rules fail", async () => {
    // "abc" fails: length, uppercase, digit -> first error is length
    await expect(useCase.execute("Test User", "test@example.com", "abc")).rejects.toThrow(
      "La contraseña debe tener al menos 8 caracteres"
    );
  });

  // --- Trimming and lowercasing ---

  it("trims name and lowercases email before calling repository", async () => {
    await useCase.execute("  John Doe  ", "  John@Example.COM  ", "ValidPass1");

    expect(authRepository.register).toHaveBeenCalledWith(
      "John Doe",
      "john@example.com",
      "ValidPass1"
    );
  });

  it("does not modify the password", async () => {
    await useCase.execute("User", "a@b.com", "  MyPass1  ");

    expect(authRepository.register).toHaveBeenCalledWith(
      "User",
      "a@b.com",
      "  MyPass1  " // password passed as-is
    );
  });

  // --- Success ---

  it("returns repository result on success", async () => {
    const expectedResult: AuthResult = {
      user: {
        id: "user-99",
        email: "new@example.com",
        name: "New User",
        role: "USER",
        is_active: true,
        is_verified: false,
        created_at: "2026-03-01T00:00:00Z",
        last_login_at: null,
      },
      token: "new-jwt-token",
    };

    (authRepository.register as ReturnType<typeof vi.fn>).mockResolvedValue(expectedResult);

    const result = await useCase.execute("New User", "new@example.com", "ValidPass1");

    expect(result).toEqual(expectedResult);
  });

  it("does not call repository when validation fails", async () => {
    await expect(useCase.execute("", "test@example.com", "ValidPass1")).rejects.toThrow();

    expect(authRepository.register).not.toHaveBeenCalled();
  });

  it("propagates repository errors", async () => {
    (authRepository.register as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Email already exists")
    );

    await expect(useCase.execute("User", "dup@example.com", "ValidPass1")).rejects.toThrow(
      "Email already exists"
    );
  });
});
