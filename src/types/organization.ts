/**
 * Organization System Types
 *
 * Type definitions for the multi-organization AED management system
 */

import type {
  OrganizationType,
  OrgScopeType,
  OrgMemberRole,
  AssignmentType,
  AssignmentStatus,
  VerificationType,
  ProposalChangeType,
  ProposalStatus,
  ChangeSource,
  ClaimType,
  ClaimStatus,
  PublicationMode,
} from "@/generated/client/client";

// ============================================
// ORGANIZATION
// ============================================

export interface Organization {
  id: string;
  type: OrganizationType;
  name: string;
  code: string | null;

  // Contact
  email: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;

  // Geographic scope
  scope_type: OrgScopeType;
  city_code: string | null;
  city_name: string | null;
  district_codes: string[];
  custom_scope_description: string | null;

  // Settings
  require_approval: boolean;
  approval_authority: string | null;

  // Badge
  badge_name: string | null;
  badge_icon: string | null;
  badge_color: string | null;

  // Hierarchy
  parent_org_id: string | null;

  is_active: boolean;

  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

export interface OrganizationWithMembers extends Organization {
  members: OrganizationMember[];
  _count?: {
    members: number;
    aed_assignments: number;
    verifications: number;
  };
}

export interface OrganizationWithParent extends Organization {
  parent_org: Organization | null;
}

// ============================================
// ORGANIZATION MEMBER
// ============================================

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgMemberRole;

  // Permissions
  can_verify: boolean;
  can_edit: boolean;
  can_approve: boolean;
  can_manage_members: boolean;

  joined_at: Date;
}

export interface OrganizationMemberWithOrg extends OrganizationMember {
  organization: Organization;
}

export interface OrganizationMemberWithUser extends OrganizationMember {
  user: {
    id: string;
    name: string;
    email: string;
  };
}

// ============================================
// AED ORGANIZATION ASSIGNMENT
// ============================================

export interface AedOrganizationAssignment {
  id: string;
  aed_id: string;
  organization_id: string;
  assignment_type: AssignmentType;
  status: AssignmentStatus;

  // Publication control
  publication_mode: PublicationMode;
  approved_for_full: boolean;
  approved_by_authority: boolean;
  approval_notes: string | null;

  // Metadata
  assigned_by: string | null;
  assigned_at: Date;
  revoked_at: Date | null;
  revoked_by: string | null;
  revoked_reason: string | null;
}

export interface AedOrganizationAssignmentWithOrg extends AedOrganizationAssignment {
  organization: Organization;
}

export interface AedOrganizationAssignmentWithAed extends AedOrganizationAssignment {
  aed: {
    id: string;
    code: string | null;
    name: string;
    latitude: number | null;
    longitude: number | null;
  };
}

// ============================================
// AED ORGANIZATION VERIFICATION
// ============================================

export interface AedOrganizationVerification {
  id: string;
  aed_id: string;
  organization_id: string;
  verification_type: VerificationType;

  verified_by: string;
  verified_at: Date;

  // What was verified
  verified_address: boolean;
  verified_schedule: boolean;
  verified_photos: boolean;
  verified_access: boolean;
  verified_signage: boolean;

  // Certificate
  certificate_number: string | null;
  certificate_expiry: Date | null;

  // Status
  is_current: boolean;
  superseded_by: string | null;
  superseded_at: Date | null;

  notes: string | null;
}

export interface AedOrganizationVerificationWithOrg extends AedOrganizationVerification {
  organization: Organization;
}

export interface AedOrganizationVerificationWithUser extends AedOrganizationVerification {
  verified_by_user: {
    id: string;
    name: string;
    email: string;
  };
}

// ============================================
// AED CHANGE PROPOSAL
// ============================================

export interface AedChangeProposal {
  id: string;
  aed_id: string;
  proposed_by: string;
  proposed_at: Date;

  change_type: ProposalChangeType;
  proposed_changes: Record<string, unknown>; // JSON
  attached_images: string[];

  status: ProposalStatus;

  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_notes: string | null;
}

export interface AedChangeProposalWithUser extends AedChangeProposal {
  proposed_by_user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface AedChangeProposalWithAed extends AedChangeProposal {
  aed: {
    id: string;
    code: string | null;
    name: string;
  };
}

// ============================================
// AED FIELD CHANGE
// ============================================

export interface AedFieldChange {
  id: string;
  aed_id: string;

  field_name: string;
  old_value: string | null;
  new_value: string | null;

  changed_by: string;
  changed_by_org: string | null;
  changed_at: Date;

  change_source: ChangeSource;
}

export interface AedFieldChangeWithUser extends AedFieldChange {
  changed_by_user: {
    id: string;
    name: string;
  };
  changed_by_organization: Organization | null;
}

// ============================================
// AED OWNERSHIP CLAIM
// ============================================

export interface AedOwnershipClaim {
  id: string;
  aed_id: string;

  claimed_by: string;
  claimed_by_org: string | null;
  claim_type: ClaimType;

  evidence_description: string;
  evidence_files: string[];

  status: ClaimStatus;

  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_notes: string | null;

  created_at: Date;
}

export interface AedOwnershipClaimWithUser extends AedOwnershipClaim {
  claimed_by_user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface AedOwnershipClaimWithAed extends AedOwnershipClaim {
  aed: {
    id: string;
    code: string | null;
    name: string;
  };
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface CreateOrganizationRequest {
  type: OrganizationType;
  name: string;
  code?: string;
  email?: string;
  phone?: string;
  website?: string;
  description?: string;
  scope_type?: OrgScopeType;
  city_code?: string;
  city_name?: string;
  district_codes?: string[];
  custom_scope_description?: string;
  require_approval?: boolean;
  approval_authority?: string;
  badge_name?: string;
  badge_icon?: string;
  badge_color?: string;
  parent_org_id?: string;
  is_active?: boolean;
}

export interface UpdateOrganizationRequest extends Partial<CreateOrganizationRequest> {
  is_active?: boolean;
}

export interface CreateAssignmentRequest {
  aed_id: string;
  organization_id: string;
  assignment_type: AssignmentType;
  publication_mode?: PublicationMode;
  notes?: string;
}

export interface UpdateAssignmentRequest {
  publication_mode?: PublicationMode;
  approved_for_full?: boolean;
  approved_by_authority?: boolean;
  approval_notes?: string;
}

export interface CreateVerificationRequest {
  aed_id: string;
  organization_id: string;
  verification_type: VerificationType;
  verified_address?: boolean;
  verified_schedule?: boolean;
  verified_photos?: boolean;
  verified_access?: boolean;
  verified_signage?: boolean;
  certificate_number?: string;
  certificate_expiry?: Date;
  notes?: string;
}

export interface CreateChangeProposalRequest {
  aed_id: string;
  change_type: ProposalChangeType;
  proposed_changes: Record<string, unknown>;
  attached_images?: string[];
}

export interface ReviewProposalRequest {
  status: "APPROVED" | "REJECTED" | "NEEDS_MORE_INFO";
  review_notes?: string;
}

export interface CreateOwnershipClaimRequest {
  aed_id: string;
  claim_type: ClaimType;
  evidence_description: string;
  evidence_files?: string[];
  claimed_by_org?: string;
}

export interface ReviewClaimRequest {
  status: "APPROVED" | "REJECTED" | "NEEDS_VERIFICATION";
  review_notes?: string;
}

// ============================================
// HELPER TYPES
// ============================================

export interface UserPermissions {
  can_view_aed: boolean;
  can_edit_aed: boolean;
  can_verify_aed: boolean;
  can_approve_publication: boolean;
  can_manage_assignments: boolean;
  organizations: OrganizationMember[];
}

export interface AedWithOrganizations {
  id: string;
  code: string | null;
  name: string;
  owner_user_id: string | null;
  assignments: AedOrganizationAssignmentWithOrg[];
  verifications: AedOrganizationVerificationWithOrg[];
}

// ============================================
// LABELS & DESCRIPTIONS
// ============================================

export const ORGANIZATION_TYPE_LABELS: Record<OrganizationType, string> = {
  CIVIL_PROTECTION: "Protección Civil",
  CERTIFIED_COMPANY: "Empresa Certificada",
  VOLUNTEER_GROUP: "Grupo de Voluntarios",
  MUNICIPALITY: "Ayuntamiento",
  HEALTH_SERVICE: "Servicio de Salud",
  OWNER: "Propietario",
};

export const SCOPE_TYPE_LABELS: Record<OrgScopeType, string> = {
  NATIONAL: "Nacional",
  REGIONAL: "Regional",
  CITY: "Municipal",
  DISTRICT: "Distrito",
  CUSTOM: "Personalizado",
};

export const MEMBER_ROLE_LABELS: Record<OrgMemberRole, string> = {
  OWNER: "Propietario",
  ADMIN: "Administrador",
  VERIFIER: "Verificador",
  MEMBER: "Miembro",
  VIEWER: "Observador",
};

export const ASSIGNMENT_TYPE_LABELS: Record<AssignmentType, string> = {
  CIVIL_PROTECTION: "Protección Civil",
  CERTIFIED_COMPANY: "Empresa Certificada",
  OWNERSHIP: "Propiedad",
  MAINTENANCE: "Mantenimiento",
  VERIFICATION: "Verificación",
};

export const VERIFICATION_TYPE_LABELS: Record<VerificationType, string> = {
  INFORMAL: "Verificación Informal",
  OFFICIAL: "Certificación Oficial",
  SELF_REPORTED: "Auto-reportado",
  FIELD_INSPECTION: "Inspección de Campo",
};

export const PROPOSAL_CHANGE_TYPE_LABELS: Record<ProposalChangeType, string> = {
  UPDATE_SCHEDULE: "Actualizar Horarios",
  UPDATE_LOCATION: "Corregir Ubicación",
  ADD_PHOTOS: "Agregar Fotos",
  UPDATE_ACCESS: "Actualizar Acceso",
  REPORT_ISSUE: "Reportar Problema",
};

export const CLAIM_TYPE_LABELS: Record<ClaimType, string> = {
  ESTABLISHMENT_OWNER: "Propietario del Establecimiento",
  EQUIPMENT_OWNER: "Propietario del Equipo",
  AUTHORIZED_MANAGER: "Gestor Autorizado",
};
