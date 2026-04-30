import { UserRole, OrgMemberRole } from "@/generated/client/enums";

export interface UserOrganization {
  id: string;
  name: string;
  type: string;
  role: OrgMemberRole;
  permissions: {
    can_verify: boolean;
    can_edit: boolean;
    can_approve: boolean;
    can_manage_members: boolean;
  };
}

export interface UserPermissions {
  // Rol global
  isAdmin: boolean;
  isModerator: boolean;

  // Permisos generales
  canAccessAdmin: boolean;
  canManageUsers: boolean;
  canManageOrganizations: boolean;
  canViewAllAeds: boolean;
  canEditAllAeds: boolean;

  // Permisos de verificación
  canVerify: boolean;
  canApprovePublications: boolean;

  // Permisos de importación/exportación
  canImportAeds: boolean;
  canExportAeds: boolean;

  // Permisos de propietario
  isOwner: boolean;
  ownedAedsCount: number;

  // Organizaciones
  organizations: UserOrganization[];
  hasOrganizations: boolean;
}

export interface UserPublic {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  is_active: boolean;
  is_verified: boolean;
  created_at: Date;
  last_login_at: Date | null;
  permissions?: UserPermissions;
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
  token?: string;
  message?: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
}
