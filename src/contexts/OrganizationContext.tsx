"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

import type { UserOrganization } from "@/types/auth";

import { useAuth } from "./AuthContext";

interface OrganizationContextType {
  selectedOrganization: UserOrganization | null;
  setSelectedOrganization: (org: UserOrganization | null) => void;
  organizations: UserOrganization[];
  hasOrganizations: boolean;
  isOrgAdmin: boolean;
  isOrgOwner: boolean;
  canManageMembers: boolean;
  canVerify: boolean;
  canEdit: boolean;
  canApprove: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

const STORAGE_KEY = "deamap_selected_organization";

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selectedOrganization, setSelectedOrganizationState] = useState<UserOrganization | null>(
    null
  );

  const organizations = user?.permissions?.organizations || [];
  const hasOrganizations = organizations.length > 0;

  // Permisos de la organización seleccionada
  const isOrgOwner = selectedOrganization?.role === "OWNER";
  const isOrgAdmin =
    selectedOrganization?.role === "ADMIN" || selectedOrganization?.role === "OWNER";
  const canManageMembers = selectedOrganization?.permissions?.can_manage_members || false;
  const canVerify = selectedOrganization?.permissions?.can_verify || false;
  const canEdit = selectedOrganization?.permissions?.can_edit || false;
  const canApprove = selectedOrganization?.permissions?.can_approve || false;

  // Cargar organización seleccionada del localStorage
  useEffect(() => {
    if (!hasOrganizations) {
      setSelectedOrganizationState(null);
      return;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedOrg = JSON.parse(stored);
        // Verificar que la organización almacenada todavía existe en las organizaciones del usuario
        const orgExists = organizations.find((org) => org.id === parsedOrg.id);
        if (orgExists) {
          setSelectedOrganizationState(orgExists);
          return;
        }
      }
    } catch (error) {
      console.error("Error loading selected organization:", error);
    }

    // Si no hay organización almacenada o no existe, seleccionar la primera
    if (organizations.length > 0) {
      setSelectedOrganizationState(organizations[0]);
    }
  }, [user]);

  // Guardar organización seleccionada en localStorage
  const setSelectedOrganization = (org: UserOrganization | null) => {
    setSelectedOrganizationState(org);
    if (org) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(org));
      } catch (error) {
        console.error("Error saving selected organization:", error);
      }
    } else {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        console.error("Error removing selected organization:", error);
      }
    }
  };

  return (
    <OrganizationContext.Provider
      value={{
        selectedOrganization,
        setSelectedOrganization,
        organizations,
        hasOrganizations,
        isOrgAdmin,
        isOrgOwner,
        canManageMembers,
        canVerify,
        canEdit,
        canApprove,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  return context;
}
