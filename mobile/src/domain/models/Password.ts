/**
 * Password validation rules as a domain value object.
 * Centralizes password policy so it can be reused across use cases.
 */
export class Password {
  static validate(raw: string): string[] {
    const errors: string[] = [];
    if (!raw || raw.length < 8) {
      errors.push("La contraseña debe tener al menos 8 caracteres");
    }
    if (!/[A-Z]/.test(raw)) {
      errors.push("La contraseña debe incluir al menos una mayúscula");
    }
    if (!/[a-z]/.test(raw)) {
      errors.push("La contraseña debe incluir al menos una minúscula");
    }
    if (!/[0-9]/.test(raw)) {
      errors.push("La contraseña debe incluir al menos un número");
    }
    return errors;
  }
}
