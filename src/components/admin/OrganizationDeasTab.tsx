/**
 * Organization DEAs Tab - Admin View
 * Uses unified DeasList component with admin features
 */

"use client";

import { DeasList } from "@/components/shared/DeasList";
import { AED_STATUS_FILTER_OPTIONS_ALL } from "@/lib/aed-status-config";

interface OrganizationDeasTabProps {
  organizationId: string;
}

export function OrganizationDeasTab({ organizationId }: OrganizationDeasTabProps) {
  return (
    <div className="-m-6">
      <DeasList
        organizationId={organizationId}
        config={{
          filters: [
            {
              key: "search",
              type: "search",
              label: "Buscar",
              placeholder: "Nombre, código, dirección...",
            },
            {
              key: "aed_status",
              type: "select",
              label: "Estado DEA",
              options: AED_STATUS_FILTER_OPTIONS_ALL,
            },
            {
              key: "assignment_type",
              type: "select",
              label: "Tipo Asignación",
              options: [
                { value: "CIVIL_PROTECTION", label: "Protección Civil" },
                { value: "CERTIFIED_COMPANY", label: "Empresa Certificada" },
                { value: "OWNERSHIP", label: "Propiedad" },
                { value: "MAINTENANCE", label: "Mantenimiento" },
                { value: "VERIFICATION", label: "Verificación" },
              ],
            },
          ],
          pagination: {
            enabled: true,
            serverSide: true,
            defaultLimit: 25,
            limitOptions: [10, 25, 50, 100],
          },
          permissions: {
            canView: true,
            canEdit: true,
            canDelete: false,
            canCreate: false,
            isAdmin: true,
          },
          emptyMessage: "No hay DEAs asignados a esta organización",
        }}
      />
    </div>
  );
}
