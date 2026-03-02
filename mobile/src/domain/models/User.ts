export type UserRole = "ADMIN" | "MODERATOR" | "USER";

export interface UserPublic {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  last_login_at: string | null;
}
