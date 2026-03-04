"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { OrganizationDeasTab } from "@/components/admin/OrganizationDeasTab";

type OrganizationType =
  | "CIVIL_PROTECTION"
  | "CERTIFIED_COMPANY"
  | "VOLUNTEER_GROUP"
  | "MUNICIPALITY"
  | "HEALTH_SERVICE"
  | "OWNER";

type OrgScopeType = "NATIONAL" | "REGIONAL" | "CITY" | "DISTRICT" | "CUSTOM";
type OrgMemberRole = "OWNER" | "ADMIN" | "VERIFIER" | "MEMBER" | "VIEWER";

interface Organization {
  id: string;
  type: OrganizationType;
  name: string;
  code: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  description: string | null;
  scope_type: OrgScopeType;
  city_code: string | null;
  city_name: string | null;
  custom_scope_description: string | null;
  require_approval: boolean;
  approval_authority: string | null;
  badge_name: string | null;
  badge_color: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  members?: OrganizationMember[];
  _count?: {
    members: number;
    aed_assignments: number;
    verifications: number;
  };
}

interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrgMemberRole;
  can_verify: boolean;
  can_edit: boolean;
  can_approve: boolean;
  can_manage_members: boolean;
  notes: string | null;
  joined_at: string;
  user: {
    id: string;
    email: string;
    name: string;
    role?: string;
    is_active?: boolean;
  };
}

interface User {
  id: string;
  email: string;
  name: string;
}

type TabType = "info" | "members" | "aeds";

export default function OrganizationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Organization>>({});
  const [activeTab, setActiveTab] = useState<TabType>("info");

  // Members state
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [newMember, setNewMember] = useState({
    user_id: "",
    role: "MEMBER" as OrgMemberRole,
    can_verify: true,
    can_edit: false,
    can_approve: false,
    can_manage_members: false,
  });

  const fetchOrganization = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/organizations/${id}`);

      if (response.status === 403) {
        router.push("/");
        return;
      }

      if (response.status === 404) {
        setError("Organización no encontrada");
        setLoading(false);
        return;
      }

      const data = await response.json();

      if (!data.success) {
        const errorMsg = data.details
          ? `${data.error}: ${data.details}`
          : data.error || "Error al cargar la organización";
        throw new Error(errorMsg);
      }

      setOrganization(data.data);
      setFormData(data.data);
      if (data.data.members) {
        setMembers(data.data.members);
      }
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const fetchMembers = useCallback(async () => {
    try {
      setLoadingMembers(true);
      const response = await fetch(`/api/admin/organizations/${id}/members`);
      const data = await response.json();

      if (data.success) {
        setMembers(data.data.members || []);
      }
    } catch (err) {
      console.error("Error fetching members:", err);
    } finally {
      setLoadingMembers(false);
    }
  }, [id]);

  const fetchAvailableUsers = async () => {
    try {
      const response = await fetch("/api/admin/users");
      const data = await response.json();
      if (data.success) {
        // Filter out users already in the organization
        const memberUserIds = members.map((m) => m.user_id);
        const available = data.data.filter((u: User) => !memberUserIds.includes(u.id));
        setAvailableUsers(available);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    }
  };

  useEffect(() => {
    fetchOrganization();
  }, [fetchOrganization]);

  useEffect(() => {
    if (activeTab === "members" && members.length === 0) {
      fetchMembers();
    }
  }, [activeTab, members.length, fetchMembers]);

  const handleSave = async () => {
    if (!formData) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/organizations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          code: formData.code || undefined,
          email: formData.email || undefined,
          phone: formData.phone || undefined,
          website: formData.website || undefined,
          description: formData.description || undefined,
          scope_type: formData.scope_type,
          city_code: formData.city_code || undefined,
          city_name: formData.city_name || undefined,
          custom_scope_description: formData.custom_scope_description || undefined,
          require_approval: formData.require_approval,
          approval_authority: formData.approval_authority || undefined,
          badge_name: formData.badge_name || undefined,
          badge_color: formData.badge_color || undefined,
          is_active: formData.is_active,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al actualizar la organización");
      }

      setOrganization(data.data);
      setFormData(data.data);
      setIsEditing(false);
      setSuccessMessage("Organización actualizada correctamente");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "¿Estás seguro de que quieres eliminar esta organización? Esta acción no se puede deshacer."
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/organizations/${id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al eliminar la organización");
      }

      router.push("/admin/organizations");
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleAddMember = async () => {
    if (!newMember.user_id) {
      setError("Selecciona un usuario");
      return;
    }

    try {
      const response = await fetch(`/api/admin/organizations/${id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMember),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al añadir miembro");
      }

      setShowAddMember(false);
      setNewMember({
        user_id: "",
        role: "MEMBER",
        can_verify: true,
        can_edit: false,
        can_approve: false,
        can_manage_members: false,
      });
      fetchMembers();
      fetchOrganization();
      setSuccessMessage("Miembro añadido correctamente");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar a ${memberEmail} de la organización?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/organizations/${id}/members/${memberId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al eliminar miembro");
      }

      fetchMembers();
      fetchOrganization();
      setSuccessMessage("Miembro eliminado correctamente");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: OrgMemberRole) => {
    try {
      const permissions = {
        can_verify: newRole === "VERIFIER" || newRole === "ADMIN" || newRole === "OWNER",
        can_edit: newRole === "ADMIN" || newRole === "OWNER",
        can_approve: newRole === "ADMIN" || newRole === "OWNER",
        can_manage_members: newRole === "OWNER",
      };

      const response = await fetch(`/api/admin/organizations/${id}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole, ...permissions }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al actualizar rol");
      }

      fetchMembers();
      setSuccessMessage("Rol actualizado correctamente");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      CIVIL_PROTECTION: "Protección Civil",
      CERTIFIED_COMPANY: "Empresa Certificada",
      VOLUNTEER_GROUP: "Grupo de Voluntarios",
      MUNICIPALITY: "Ayuntamiento",
      HEALTH_SERVICE: "Servicio de Salud",
      OWNER: "Propietario",
    };
    return labels[type] || type;
  };

  const _getRoleLabel = (role: string) => {
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
      OWNER: "bg-purple-100 text-purple-800",
      ADMIN: "bg-blue-100 text-blue-800",
      VERIFIER: "bg-green-100 text-green-800",
      MEMBER: "bg-gray-100 text-gray-800",
      VIEWER: "bg-yellow-100 text-yellow-800",
    };
    return colors[role] || "bg-gray-100 text-gray-800";
  };

  const getScopeLabel = (scope: string) => {
    const labels: Record<string, string> = {
      NATIONAL: "Nacional",
      REGIONAL: "Regional",
      CITY: "Municipal",
      DISTRICT: "Distrito",
      CUSTOM: "Personalizado",
    };
    return labels[scope] || scope;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Cargando organización...</div>
      </div>
    );
  }

  if (error && !organization) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border-l-4 border-red-400 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
          <Link
            href="/admin/organizations"
            className="mt-4 text-sm text-blue-600 hover:text-blue-800 inline-block"
          >
            ← Volver a Organizaciones
          </Link>
        </div>
      </div>
    );
  }

  if (!organization) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/organizations"
            className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
          >
            ← Volver a Organizaciones
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{organization.name}</h1>
              <p className="mt-2 text-sm text-gray-600">
                {getTypeLabel(organization.type)} • ID: {organization.id.slice(0, 8)}...
              </p>
            </div>
            <div className="flex gap-3">
              {activeTab === "info" && !isEditing && (
                <>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                  >
                    Editar
                  </button>
                  <button
                    onClick={handleDelete}
                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                  >
                    Eliminar
                  </button>
                </>
              )}
              {activeTab === "info" && isEditing && (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setFormData(organization);
                      setError(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "Guardando..." : "Guardar"}
                  </button>
                </>
              )}
              {activeTab === "members" && (
                <button
                  onClick={() => {
                    setShowAddMember(true);
                    fetchAvailableUsers();
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  + Añadir Miembro
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={() => setError(null)} className="text-xs text-red-600 underline mt-1">
              Cerrar
            </button>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
            <p className="text-sm text-green-700">{successMessage}</p>
          </div>
        )}

        {/* Stats */}
        {organization._count && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-6">
            <div
              className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setActiveTab("members")}
            >
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">Miembros</dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">
                  {organization._count.members}
                </dd>
              </div>
            </div>
            <div
              className="bg-white overflow-hidden shadow rounded-lg cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setActiveTab("aeds")}
            >
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">DEAs Asignados</dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">
                  {organization._count.aed_assignments}
                </dd>
              </div>
            </div>
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-gray-500 truncate">Verificaciones</dt>
                <dd className="mt-1 text-3xl font-semibold text-gray-900">
                  {organization._count.verifications}
                </dd>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white shadow rounded-lg">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex" aria-label="Tabs">
              <button
                onClick={() => setActiveTab("info")}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === "info"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Información General
              </button>
              <button
                onClick={() => setActiveTab("members")}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === "members"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                Miembros ({organization._count?.members || 0})
              </button>
              <button
                onClick={() => setActiveTab("aeds")}
                className={`py-4 px-6 text-sm font-medium border-b-2 ${
                  activeTab === "aeds"
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                DEAs ({organization._count?.aed_assignments || 0})
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* Info Tab */}
            {activeTab === "info" && (
              <>
                {!isEditing ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Tipo</h3>
                        <p className="mt-1 text-sm text-gray-900">
                          {getTypeLabel(organization.type)}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Código</h3>
                        <p className="mt-1 text-sm text-gray-900">{organization.code || "—"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Email</h3>
                        <p className="mt-1 text-sm text-gray-900">{organization.email || "—"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Teléfono</h3>
                        <p className="mt-1 text-sm text-gray-900">{organization.phone || "—"}</p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Sitio Web</h3>
                        <p className="mt-1 text-sm text-gray-900">
                          {organization.website ? (
                            <a
                              href={organization.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800"
                            >
                              {organization.website}
                            </a>
                          ) : (
                            "—"
                          )}
                        </p>
                      </div>
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Estado</h3>
                        <p className="mt-1 text-sm text-gray-900">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${organization.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                          >
                            {organization.is_active ? "Activa" : "Inactiva"}
                          </span>
                        </p>
                      </div>
                    </div>

                    {organization.description && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-500">Descripción</h3>
                        <p className="mt-1 text-sm text-gray-900">{organization.description}</p>
                      </div>
                    )}

                    <div className="border-t pt-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Ámbito Geográfico</h3>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Tipo de Ámbito</h3>
                          <p className="mt-1 text-sm text-gray-900">
                            {getScopeLabel(organization.scope_type)}
                          </p>
                        </div>
                        {organization.city_name && (
                          <>
                            <div>
                              <h3 className="text-sm font-medium text-gray-500">Ciudad</h3>
                              <p className="mt-1 text-sm text-gray-900">{organization.city_name}</p>
                            </div>
                            <div>
                              <h3 className="text-sm font-medium text-gray-500">
                                Código de Ciudad
                              </h3>
                              <p className="mt-1 text-sm text-gray-900">
                                {organization.city_code || "—"}
                              </p>
                            </div>
                          </>
                        )}
                        {organization.custom_scope_description && (
                          <div className="col-span-2">
                            <h3 className="text-sm font-medium text-gray-500">
                              Descripción del Ámbito
                            </h3>
                            <p className="mt-1 text-sm text-gray-900">
                              {organization.custom_scope_description}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Configuración</h3>
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <h3 className="text-sm font-medium text-gray-500">Requiere Aprobación</h3>
                          <p className="mt-1 text-sm text-gray-900">
                            {organization.require_approval ? "Sí" : "No"}
                          </p>
                        </div>
                        {organization.approval_authority && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-500">
                              Autoridad de Aprobación
                            </h3>
                            <p className="mt-1 text-sm text-gray-900">
                              {organization.approval_authority}
                            </p>
                          </div>
                        )}
                        {organization.badge_name && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-500">Badge</h3>
                            <p className="mt-1 text-sm text-gray-900">
                              <span
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                                style={{
                                  backgroundColor: organization.badge_color || "#3B82F6",
                                  color: "white",
                                }}
                              >
                                {organization.badge_name}
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <form className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Nombre *</label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name || ""}
                          onChange={handleChange}
                          required
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Código</label>
                        <input
                          type="text"
                          name="code"
                          value={formData.code || ""}
                          onChange={handleChange}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Email</label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email || ""}
                          onChange={handleChange}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone || ""}
                          onChange={handleChange}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Sitio Web</label>
                        <input
                          type="url"
                          name="website"
                          value={formData.website || ""}
                          onChange={handleChange}
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="flex items-center mt-6">
                          <input
                            type="checkbox"
                            name="is_active"
                            checked={formData.is_active ?? true}
                            onChange={handleChange}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-700">Organización Activa</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Descripción</label>
                      <textarea
                        name="description"
                        value={formData.description || ""}
                        onChange={handleChange}
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                  </form>
                )}
              </>
            )}

            {/* Members Tab */}
            {activeTab === "members" && (
              <div>
                {loadingMembers ? (
                  <div className="text-center py-8 text-gray-500">Cargando miembros...</div>
                ) : members.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No hay miembros en esta organización
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Usuario
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Rol
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Permisos
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Fecha de Ingreso
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {members.map((member) => (
                          <tr key={member.id}>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="h-10 w-10 flex-shrink-0">
                                  <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 font-medium">
                                    {member.user.name?.charAt(0).toUpperCase() || "?"}
                                  </div>
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    {member.user.name}
                                  </div>
                                  <div className="text-sm text-gray-500">{member.user.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <select
                                value={member.role}
                                onChange={(e) =>
                                  handleUpdateMemberRole(member.id, e.target.value as OrgMemberRole)
                                }
                                className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${getRoleBadgeColor(member.role)} border-0 cursor-pointer`}
                              >
                                <option value="OWNER">Propietario</option>
                                <option value="ADMIN">Administrador</option>
                                <option value="VERIFIER">Verificador</option>
                                <option value="MEMBER">Miembro</option>
                                <option value="VIEWER">Observador</option>
                              </select>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <div className="flex gap-1">
                                {member.can_verify && (
                                  <span className="px-1.5 py-0.5 bg-green-100 text-green-800 text-xs rounded">
                                    Verificar
                                  </span>
                                )}
                                {member.can_edit && (
                                  <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 text-xs rounded">
                                    Editar
                                  </span>
                                )}
                                {member.can_approve && (
                                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-800 text-xs rounded">
                                    Aprobar
                                  </span>
                                )}
                                {member.can_manage_members && (
                                  <span className="px-1.5 py-0.5 bg-red-100 text-red-800 text-xs rounded">
                                    Gestionar
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(member.joined_at).toLocaleDateString("es-ES")}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => handleRemoveMember(member.id, member.user.email)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Add Member Modal */}
                {showAddMember && (
                  <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-4">Añadir Miembro</h3>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Usuario</label>
                          <select
                            value={newMember.user_id}
                            onChange={(e) =>
                              setNewMember({ ...newMember, user_id: e.target.value })
                            }
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          >
                            <option value="">Seleccionar usuario...</option>
                            {availableUsers.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name} ({user.email})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700">Rol</label>
                          <select
                            value={newMember.role}
                            onChange={(e) => {
                              const role = e.target.value as OrgMemberRole;
                              setNewMember({
                                ...newMember,
                                role,
                                can_verify:
                                  role === "VERIFIER" || role === "ADMIN" || role === "OWNER",
                                can_edit: role === "ADMIN" || role === "OWNER",
                                can_approve: role === "ADMIN" || role === "OWNER",
                                can_manage_members: role === "OWNER",
                              });
                            }}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                          >
                            <option value="VIEWER">Observador</option>
                            <option value="MEMBER">Miembro</option>
                            <option value="VERIFIER">Verificador</option>
                            <option value="ADMIN">Administrador</option>
                            <option value="OWNER">Propietario</option>
                          </select>
                        </div>
                      </div>

                      <div className="mt-6 flex justify-end gap-3">
                        <button
                          onClick={() => setShowAddMember(false)}
                          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleAddMember}
                          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                        >
                          Añadir
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* DEAs Tab */}
            {activeTab === "aeds" && <OrganizationDeasTab organizationId={id} />}
          </div>
        </div>
      </div>
    </div>
  );
}
