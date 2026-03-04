"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Organization {
  id: string;
  type: string;
  name: string;
  code: string | null;
  city_name: string | null;
  is_active: boolean;
  _count?: {
    members: number;
    aed_assignments: number;
    verifications: number;
  };
}

export default function OrganizationsPage() {
  const router = useRouter();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState({
    type: "",
    is_active: "true",
    city_code: "",
  });

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter.type) params.append("type", filter.type);
      if (filter.is_active) params.append("is_active", filter.is_active);
      if (filter.city_code) params.append("city_code", filter.city_code);

      const response = await fetch(`/api/admin/organizations?${params.toString()}`);

      if (response.status === 403) {
        router.push("/");
        return;
      }

      const data = await response.json();

      if (!data.success) {
        const errorMsg = data.details
          ? `${data.error}: ${data.details}`
          : data.error || "Error al cargar organizaciones";
        throw new Error(errorMsg);
      }

      setOrganizations(data.data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, [filter]);

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

  const getTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      CIVIL_PROTECTION: "bg-red-100 text-red-800",
      CERTIFIED_COMPANY: "bg-blue-100 text-blue-800",
      VOLUNTEER_GROUP: "bg-green-100 text-green-800",
      MUNICIPALITY: "bg-purple-100 text-purple-800",
      HEALTH_SERVICE: "bg-pink-100 text-pink-800",
      OWNER: "bg-yellow-100 text-yellow-800",
    };
    return colors[type] || "bg-gray-100 text-gray-800";
  };

  if (loading && organizations.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Cargando organizaciones...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <Link
                href="/admin"
                className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
              >
                ← Volver al panel
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Gestión de Organizaciones</h1>
              <p className="mt-2 text-sm text-gray-600">
                Administra protecciones civiles, empresas certificadas y grupos de voluntarios
              </p>
            </div>
            <Link
              href="/admin/organizations/new"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Nueva Organización
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="type-filter" className="block text-sm font-medium text-gray-700">
                Tipo
              </label>
              <select
                id="type-filter"
                value={filter.type}
                onChange={(e) => setFilter({ ...filter, type: e.target.value })}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="">Todos los tipos</option>
                <option value="CIVIL_PROTECTION">Protección Civil</option>
                <option value="CERTIFIED_COMPANY">Empresa Certificada</option>
                <option value="VOLUNTEER_GROUP">Grupo de Voluntarios</option>
                <option value="MUNICIPALITY">Ayuntamiento</option>
                <option value="HEALTH_SERVICE">Servicio de Salud</option>
                <option value="OWNER">Propietario</option>
              </select>
            </div>

            <div>
              <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700">
                Estado
              </label>
              <select
                id="status-filter"
                value={filter.is_active}
                onChange={(e) => setFilter({ ...filter, is_active: e.target.value })}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="">Todos</option>
                <option value="true">Activas</option>
                <option value="false">Inactivas</option>
              </select>
            </div>

            <div>
              <label htmlFor="city-filter" className="block text-sm font-medium text-gray-700">
                Código de ciudad
              </label>
              <input
                type="text"
                id="city-filter"
                value={filter.city_code}
                onChange={(e) => setFilter({ ...filter, city_code: e.target.value })}
                placeholder="ej. 28079 (Madrid)"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Organizations List */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {organizations.length === 0 ? (
              <li className="px-6 py-8 text-center text-gray-500">
                No se encontraron organizaciones
              </li>
            ) : (
              organizations.map((org) => (
                <li key={org.id}>
                  <Link
                    href={`/admin/organizations/${org.id}`}
                    className="block hover:bg-gray-50 transition-colors"
                  >
                    <div className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <h3 className="text-lg font-medium text-gray-900 truncate">
                              {org.name}
                            </h3>
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeBadgeColor(
                                org.type
                              )}`}
                            >
                              {getTypeLabel(org.type)}
                            </span>
                            {!org.is_active && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Inactiva
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                            {org.code && (
                              <span className="flex items-center">
                                <svg
                                  className="h-4 w-4 mr-1"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                                  />
                                </svg>
                                {org.code}
                              </span>
                            )}
                            {org.city_name && (
                              <span className="flex items-center">
                                <svg
                                  className="h-4 w-4 mr-1"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                  />
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                  />
                                </svg>
                                {org.city_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-6 text-sm text-gray-500">
                          {org._count && (
                            <>
                              <div className="text-center">
                                <div className="text-2xl font-semibold text-gray-900">
                                  {org._count.members}
                                </div>
                                <div className="text-xs">Miembros</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-semibold text-gray-900">
                                  {org._count.aed_assignments}
                                </div>
                                <div className="text-xs">DEAs</div>
                              </div>
                              <div className="text-center">
                                <div className="text-2xl font-semibold text-gray-900">
                                  {org._count.verifications}
                                </div>
                                <div className="text-xs">Verificaciones</div>
                              </div>
                            </>
                          )}
                          <svg
                            className="h-5 w-5 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
