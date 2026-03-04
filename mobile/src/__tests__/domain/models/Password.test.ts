import { describe, it, expect } from "vitest";
import { Password } from "../../../domain/models/Password";

describe("Password.validate", () => {
  it("returns empty array for a valid password (8+ chars, uppercase, lowercase, digit)", () => {
    const errors = Password.validate("Abcdefg1");
    expect(errors).toEqual([]);
  });

  it("returns empty array for a long valid password", () => {
    const errors = Password.validate("StrongPass123");
    expect(errors).toEqual([]);
  });

  it("returns error for short passwords (< 8 chars)", () => {
    const errors = Password.validate("Ab1cdef");
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors).toContain("La contraseña debe tener al menos 8 caracteres");
  });

  it("returns error for empty string", () => {
    const errors = Password.validate("");
    expect(errors).toContain("La contraseña debe tener al menos 8 caracteres");
  });

  it("returns errors when null is passed", () => {
    const errors = Password.validate(null as unknown as string);
    // null is falsy, so the length check triggers; regex tests on null also fail
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors).toContain("La contraseña debe tener al menos 8 caracteres");
  });

  it("returns errors when undefined is passed", () => {
    const errors = Password.validate(undefined as unknown as string);
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors).toContain("La contraseña debe tener al menos 8 caracteres");
  });

  it("returns error for missing uppercase", () => {
    const errors = Password.validate("abcdefg1");
    expect(errors).toContain("La contraseña debe incluir al menos una mayúscula");
    // Should NOT contain the length error
    expect(errors).not.toContain("La contraseña debe tener al menos 8 caracteres");
  });

  it("returns error for missing lowercase", () => {
    const errors = Password.validate("ABCDEFG1");
    expect(errors).toContain("La contraseña debe incluir al menos una minúscula");
    expect(errors).not.toContain("La contraseña debe tener al menos 8 caracteres");
  });

  it("returns error for missing digit", () => {
    const errors = Password.validate("Abcdefgh");
    expect(errors).toContain("La contraseña debe incluir al menos un número");
    expect(errors).not.toContain("La contraseña debe tener al menos 8 caracteres");
  });

  it("returns multiple errors when multiple rules fail", () => {
    // "abc" is short, missing uppercase and digit
    const errors = Password.validate("abc");
    expect(errors).toContain("La contraseña debe tener al menos 8 caracteres");
    expect(errors).toContain("La contraseña debe incluir al menos una mayúscula");
    expect(errors).toContain("La contraseña debe incluir al menos un número");
    expect(errors.length).toBe(3);
  });

  it("returns all four errors for an empty string", () => {
    const errors = Password.validate("");
    expect(errors).toHaveLength(4);
    expect(errors).toContain("La contraseña debe tener al menos 8 caracteres");
    expect(errors).toContain("La contraseña debe incluir al menos una mayúscula");
    expect(errors).toContain("La contraseña debe incluir al menos una minúscula");
    expect(errors).toContain("La contraseña debe incluir al menos un número");
  });

  it("passes for exactly 8 characters that meets all rules", () => {
    const errors = Password.validate("Passw0rd");
    expect(errors).toEqual([]);
  });

  it("passes for a password with special characters when all rules are met", () => {
    const errors = Password.validate("P@ssw0rd!");
    expect(errors).toEqual([]);
  });
});
