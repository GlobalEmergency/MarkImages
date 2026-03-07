/**
 * Organization DEAs Page
 * Shows admin mode (editable links) for org editors,
 * public view for regular members and verifiers.
 */

"use client";

import { use } from "react";
import { DeasList } from "@/components/shared/DeasList";
import { useOrganization } from "@/contexts/OrganizationContext";
import { AED_STATUS_FILTER_OPTIONS_USER } from "@/lib/aed-status-config";

export default function OrgDeasPage({ params }: { params: Promise<{ orgId: string }> }) {
  const resolvedParams = use(params);
  const orgId = resolvedParams.orgId;
  const { canEdit } = useOrganization();

  return (
    <DeasList
      organizationId={orgId}
      adminMode={canEdit}
      config={{
        filters: [
          {
            key: "search",
            type: "search",
            label: "Buscar",
            placeholder: "Buscar por nombre, dirección o ciudad...",
          },
          {
            key: "aed_status",
            type: "select",
            label: "Estado del DEA",
            options: AED_STATUS_FILTER_OPTIONS_USER,
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
