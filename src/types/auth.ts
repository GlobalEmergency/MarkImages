import { UserRole } from "@prisma/client";

export interface UserPublic {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: Date;
  last_login_at: Date | null;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: UserPublic;
  message?: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
}
