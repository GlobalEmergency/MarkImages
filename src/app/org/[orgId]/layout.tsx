"use client";

import { useRouter } from "next/navigation";
import { useEffect, use } from "react";

import OrgBottomNavigation from "@/components/OrgBottomNavigation";
import OrgSelector from "@/components/OrgSelector";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";

export default function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { user, loading } = useAuth();
  const { selectedOrganization, organizations, setSelectedOrganization } = useOrganization();
  const router = useRouter();
  const resolvedParams = use(params);
  const orgId = resolvedParams.orgId;

  // Verificar que el usuario tenga acceso a la organización
  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    const org = organizations.find((o) => o.id === orgId);

    if (!org) {
      // El usuario no tiene acceso a esta organización
      router.push("/");
      return;
    }

    // Si la organización seleccionada no coincide con la de la URL, actualizarla
    if (selectedOrganization?.id !== orgId) {
      setSelectedOrganization(org);
    }
  }, [user, loading, organizations, orgId, router, selectedOrganization]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || !selectedOrganization) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16 md:pb-0">
      {/* Header con selector de organización */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <OrgSelector />
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-7xl mx-auto">{children}</div>

      {/* Bottom Navigation para móvil */}
      <OrgBottomNavigation />
    </div>
  );
}
