"use client";

import { Building2, Mail, Phone, Globe, MapPin, Shield, Info, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, use } from "react";

import { useOrganization } from "@/contexts/OrganizationContext";

interface OrganizationDetails {
  id: string;
  type: string;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  scope_type: string;
  city_name: string | null;
  district_codes: string[];
  require_approval: boolean;
  approval_authority: string | null;
  badge_name: string | null;
  badge_color: string | null;
  created_at: Date;
}

export default function OrgSettingsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { canManageMembers, isOrgOwner } = useOrganization();
  const [org, setOrg] = useState<OrganizationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const resolvedParams = use(params);
  const orgId = resolvedParams.orgId;

  useEffect(() => {
    // Solo admins y owners pueden ver configuración
    if (!canManageMembers && !isOrgOwner) {
      router.push(`/org/${orgId}`);
      return;
    }

    fetchOrganizationDetails();
  }, [orgId, canManageMembers, isOrgOwner]);

  const fetchOrganizationDetails = async () => {
    try {
      const response = await fetch(`/api/organizations/${orgId}`);
      if (response.ok) {
        const data = await response.json();
        setOrg(data);
      }
    } catch (error) {
      console.error("Error fetching organization details:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      CIVIL_PROTECTION: "Protección Civil",
      CERTIFIED_COMPANY: "Empresa Certificada",
      EMERGENCY_SERVICES: "Servicios de Emergencia",
      HEALTHCARE: "Centro Sanitario",
      SPORTS_FACILITY: "Instalación Deportiva",
      EDUCATIONAL: "Centro Educativo",
      COMMERCIAL: "Centro Comercial",
      PUBLIC_ADMINISTRATION: "Administración Pública",
      PRIVATE_ENTITY: "Entidad Privada",
      NGO: "ONG",
      OTHER: "Otro",
    };
    return labels[type] || type;
  };

  const getScopeLabel = (scope: string) => {
    const labels: Record<string, string> = {
      NATIONAL: "Nacional",
      REGIONAL: "Regional",
      PROVINCIAL: "Provincial",
      CITY: "Ciudad",
      DISTRICT: "Distrito",
      CUSTOM: "Personalizado",
    };
    return labels[scope] || scope;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!org || (!canManageMembers && !isOrgOwner)) {
    return null;
  }

  return (
    <div className="px-4 py-6 space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-600">Información de la organización</p>
      </div>

      {/* Organization Header Card */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-5 border border-blue-200">
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
            {org.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900 mb-1">{org.name}</h2>
            <p className="text-sm text-gray-700 flex items-center gap-1">
              <Building2 className="w-4 h-4" />
              {getTypeLabel(org.type)}
            </p>
            {org.code && (
              <p className="text-xs text-gray-600 mt-1">
                Código: <span className="font-mono font-semibold">{org.code}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="bg-white rounded-xl p-5 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Mail className="w-5 h-5 text-blue-600" />
          Información de contacto
        </h3>
        <div className="space-y-3">
          {org.email && (
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-600 mb-0.5">Email</p>
                <a href={`mailto:${org.email}`} className="text-sm text-blue-600 hover:underline">
                  {org.email}
                </a>
              </div>
            </div>
          )}

          {org.phone && (
            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-600 mb-0.5">Teléfono</p>
                <a href={`tel:${org.phone}`} className="text-sm text-blue-600 hover:underline">
                  {org.phone}
                </a>
              </div>
            </div>
          )}

          {org.website && (
            <div className="flex items-start gap-3">
              <Globe className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-600 mb-0.5">Sitio web</p>
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  {org.website}
                </a>
              </div>
            </div>
          )}

          {!org.email && !org.phone && !org.website && (
            <p className="text-sm text-gray-500 italic">
              No hay información de contacto disponible
            </p>
          )}
        </div>
      </div>

      {/* Geographic Scope */}
      <div className="bg-white rounded-xl p-5 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" />
          Ámbito geográfico
        </h3>
        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-600 mb-0.5">Tipo de ámbito</p>
            <p className="text-sm font-medium text-gray-900">{getScopeLabel(org.scope_type)}</p>
          </div>

          {org.city_name && (
            <div>
              <p className="text-xs text-gray-600 mb-0.5">Ciudad</p>
              <p className="text-sm font-medium text-gray-900">{org.city_name}</p>
            </div>
          )}

          {org.district_codes.length > 0 && (
            <div>
              <p className="text-xs text-gray-600 mb-0.5">Distritos</p>
              <p className="text-sm font-medium text-gray-900">
                {org.district_codes.length} distrito(s)
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {org.description && (
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Info className="w-5 h-5 text-blue-600" />
            Descripción
          </h3>
          <p className="text-sm text-gray-700 leading-relaxed">{org.description}</p>
        </div>
      )}

      {/* Badge */}
      {org.badge_name && (
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Tag className="w-5 h-5 text-blue-600" />
            Insignia
          </h3>
          <div className="flex items-center gap-3">
            <span
              className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium"
              style={{
                backgroundColor: org.badge_color || "#3b82f6",
                color: "#ffffff",
              }}
            >
              {org.badge_name}
            </span>
          </div>
        </div>
      )}

      {/* Approval Settings */}
      <div className="bg-white rounded-xl p-5 border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-blue-600" />
          Configuración de aprobaciones
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Requiere aprobación</span>
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                org.require_approval ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
              }`}
            >
              {org.require_approval ? "Sí" : "No"}
            </span>
          </div>

          {org.approval_authority && (
            <div>
              <p className="text-xs text-gray-600 mb-0.5">Autoridad aprobadora</p>
              <p className="text-sm font-medium text-gray-900">{org.approval_authority}</p>
            </div>
          )}
        </div>
      </div>

      {/* Meta Information */}
      <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
        <p className="text-xs text-gray-600">
          Organización creada el{" "}
          {new Date(org.created_at).toLocaleDateString("es-ES", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">¿Necesitas actualizar la información?</p>
            <p className="text-blue-800 text-xs">
              Para modificar los datos de la organización, contacta con el administrador del sistema
              o con soporte técnico.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
