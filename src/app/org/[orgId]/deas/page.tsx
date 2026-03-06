/**
 * Organization DEAs Page
 * Shows admin mode (editable links) for org editors/verifiers,
 * public view for regular members.
 */

"use client";

import { use } from "react";
import { DeasList } from "@/components/shared/DeasList";
import { useOrganization } from "@/contexts/OrganizationContext";

export default function OrgDeasPage({ params }: { params: Promise<{ orgId: string }> }) {
  const resolvedParams = use(params);
  const orgId = resolvedParams.orgId;
  const { canEdit, canVerify } = useOrganization();
  const hasAdminAccess = canEdit || canVerify;

  return (
    <DeasList
      organizationId={orgId}
      adminMode={hasAdminAccess}
      config={{
        filters: [
          {
            key: "search",
            type: "search",
            label: "Buscar",
            placeholder: "Buscar por nombre, dirección o ciudad...",
          },
          {
            key: "status",
            type: "select",
            label: "Estado",
            options: [
              { value: "active", label: "Activos" },
              { value: "inactive", label: "Inactivos" },
            ],
          },
        ],
        pagination: {
          enabled: false,
          serverSide: false,
          defaultLimit: 25,
          limitOptions: [10, 25, 50],
        },
        permissions: {
          canView: true,
          canEdit: canEdit,
          canDelete: false,
          canCreate: false,
        },
        emptyMessage: "No se encontraron DEAs en esta organización",
      }}
    />
  );
}
