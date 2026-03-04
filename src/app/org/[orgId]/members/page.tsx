"use client";

import { Users, Shield, UserPlus, Mail, CheckCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, use } from "react";

import { useOrganization } from "@/contexts/OrganizationContext";

interface Member {
  id: string;
  user_id: string;
  role: string;
  can_verify: boolean;
  can_edit: boolean;
  can_approve: boolean;
  can_manage_members: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    is_active: boolean;
  };
  joined_at: Date;
}

export default function OrgMembersPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { canManageMembers } = useOrganization();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const resolvedParams = use(params);
  const orgId = resolvedParams.orgId;

  useEffect(() => {
    // Verificar permisos
    if (!canManageMembers) {
      router.push(`/org/${orgId}`);
      return;
    }

    fetchMembers();
  }, [orgId, canManageMembers]);

  const fetchMembers = async () => {
    try {
      const response = await fetch(`/api/organizations/${orgId}/members`);
      if (response.ok) {
        const data = await response.json();
        setMembers(data.members || []);
      }
    } catch (error) {
      console.error("Error fetching members:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      OWNER: "Propietario",
      ADMIN: "Administrador",
      VERIFIER: "Verificador",
      MEMBER: "Miembro",
      VIEWER: "Observador",
    };
    return labels[role] || role;
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      OWNER: "bg-purple-100 text-purple-700 border-purple-200",
      ADMIN: "bg-blue-100 text-blue-700 border-blue-200",
      VERIFIER: "bg-green-100 text-green-700 border-green-200",
      MEMBER: "bg-gray-100 text-gray-700 border-gray-200",
      VIEWER: "bg-gray-100 text-gray-600 border-gray-200",
    };
    return colors[role] || "bg-gray-100 text-gray-700 border-gray-200";
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!canManageMembers) {
    return null;
  }

  return (
    <div className="px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-gray-900">Equipo</h1>
          <p className="text-sm text-gray-600">{members.length} miembros</p>
        </div>

        {/* Add Member Button - Placeholder for future functionality */}
        <button
          className="p-3 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors active:scale-95 shadow-lg"
          onClick={() => {
            // TODO: Implement add member functionality
            alert("Funcionalidad próximamente disponible");
          }}
        >
          <UserPlus className="w-5 h-5" />
        </button>
      </div>

      {/* Members List */}
      <div className="space-y-3">
        {members.map((member) => (
          <div key={member.id} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                {getInitials(member.user.name)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Name and Status */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{member.user.name}</h3>
                    <p className="text-sm text-gray-600 truncate flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      {member.user.email}
                    </p>
                  </div>

                  {member.user.is_active ? (
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                </div>

                {/* Role Badge */}
                <div className="mt-2 mb-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border ${getRoleBadgeColor(
                      member.role
                    )}`}
                  >
                    <Shield className="w-3 h-3" />
                    {getRoleLabel(member.role)}
                  </span>
                </div>

                {/* Permissions */}
                <div className="flex flex-wrap gap-2">
                  {member.can_verify && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-green-50 text-green-700 border border-green-200">
                      <CheckCircle className="w-3 h-3" />
                      Verificar
                    </span>
                  )}
                  {member.can_edit && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200">
                      <CheckCircle className="w-3 h-3" />
                      Editar
                    </span>
                  )}
                  {member.can_approve && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-purple-50 text-purple-700 border border-purple-200">
                      <CheckCircle className="w-3 h-3" />
                      Aprobar
                    </span>
                  )}
                  {member.can_manage_members && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-orange-50 text-orange-700 border border-orange-200">
                      <CheckCircle className="w-3 h-3" />
                      Gestionar
                    </span>
                  )}
                </div>

                {/* Joined Date */}
                <p className="text-xs text-gray-500 mt-2">
                  Miembro desde{" "}
                  {new Date(member.joined_at).toLocaleDateString("es-ES", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {members.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No hay miembros en la organización</p>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <div className="flex gap-3">
          <Shield className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">Roles y permisos</p>
            <ul className="text-blue-800 space-y-1 text-xs">
              <li>
                • <strong>Propietario:</strong> Control total de la organización
              </li>
              <li>
                • <strong>Administrador:</strong> Puede verificar, editar y aprobar
              </li>
              <li>
                • <strong>Verificador:</strong> Solo puede verificar DEAs
              </li>
              <li>
                • <strong>Miembro:</strong> Acceso limitado
              </li>
              <li>
                • <strong>Observador:</strong> Solo lectura
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
