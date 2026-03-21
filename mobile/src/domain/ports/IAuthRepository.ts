import { UserPublic } from "../models/User";

export interface AuthResult {
  user: UserPublic;
  token: string;
}

export interface IAuthRepository {
  login(email: string, password: string): Promise<AuthResult>;
  register(name: string, email: string, password: string): Promise<AuthResult>;
  logout(): Promise<void>;
  deleteAccount(password: string): Promise<void>;
  getMe(): Promise<UserPublic | null>;
}
