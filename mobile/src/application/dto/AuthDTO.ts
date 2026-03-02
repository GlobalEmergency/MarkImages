import { UserPublic } from "../../domain/models/User";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: UserPublic;
  token?: string;
  message?: string;
}
