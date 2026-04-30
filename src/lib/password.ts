import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push("La contraseÃ±a debe tener al menos 8 caracteres");
  }

  if (!/[A-Z]/.test(password)) {
    errors.push("La contraseÃ±a debe contener al menos una letra mayÃºscula");
  }

  if (!/[a-z]/.test(password)) {
    errors.push("La contraseÃ±a debe contener al menos una letra minÃºscula");
  }

  if (!/[0-9]/.test(password)) {
    errors.push("La contraseÃ±a debe contener al menos un nÃºmero");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
