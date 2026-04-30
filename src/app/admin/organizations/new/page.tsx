"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type OrganizationType =
  | "CIVIL_PROTECTION"
  | "CERTIFIED_COMPANY"
  | "VOLUNTEER_GROUP"
  | "MUNICIPALITY"
  | "HEALTH_SERVICE"
  | "OWNER";

type OrgScopeType = "NATIONAL" | "REGIONAL" | "CITY" | "DISTRICT" | "CUSTOM";

interface FormData {
  type: OrganizationType;
  name: string;
  code: string;
  email: string;
  phone: string;
  website: string;
  description: string;
  scope_type: OrgScopeType;
  city_code: string;
  city_name: string;
  custom_scope_description: string;
  require_approval: boolean;
  approval_authority: string;
  badge_name: string;
  badge_color: string;
}

export default function NewOrganizationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    type: "CIVIL_PROTECTION",
    name: "",
    code: "",
    email: "",
    phone: "",
    website: "",
    description: "",
    scope_type: "CITY",
    city_code: "",
    city_name: "",
    custom_scope_description: "",
    require_approval: true,
    approval_authority: "",
    badge_name: "",
    badge_color: "#3B82F6",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formData.type,
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
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al crear la organizaciÃ³n");
      }

      router.push("/admin/organizations");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear la organizaciÃ³n");
    } finally {
      setLoading(false);
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link
            href="/admin/organizations"
            className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
          >
            â† Volver a Organizaciones
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Nueva OrganizaciÃ³n</h1>
          <p className="mt-2 text-sm text-gray-600">
            Crea una nueva protecciÃ³n civil, empresa certificada o grupo de voluntarios
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white shadow rounded-lg p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">InformaciÃ³n BÃ¡sica</h2>

            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                Tipo de OrganizaciÃ³n *
              </label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="CIVIL_PROTECTION">ProtecciÃ³n Civil</option>
                <option value="CERTIFIED_COMPANY">Empresa Certificada</option>
                <option value="VOLUNTEER_GROUP">Grupo de Voluntarios</option>
                <option value="MUNICIPALITY">Ayuntamiento</option>
                <option value="HEALTH_SERVICE">Servicio de Salud</option>
                <option value="OWNER">Propietario</option>
              </select>
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                Nombre *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="code" className="block text-sm font-medium text-gray-700">
                CÃ³digo (Ãºnico)
              </label>
              <input
                type="text"
                id="code"
                name="code"
                value={formData.code}
                onChange={handleChange}
                placeholder="ej. PROTE_MADRID"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                DescripciÃ³n
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Contact Information */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">InformaciÃ³n de Contacto</h2>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                TelÃ©fono
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="website" className="block text-sm font-medium text-gray-700">
                Sitio Web
              </label>
              <input
                type="url"
                id="website"
                name="website"
                value={formData.website}
                onChange={handleChange}
                placeholder="https://"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Geographic Scope */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">Ãmbito GeogrÃ¡fico</h2>

            <div>
              <label htmlFor="scope_type" className="block text-sm font-medium text-gray-700">
                Tipo de Ãmbito
              </label>
              <select
                id="scope_type"
                name="scope_type"
                value={formData.scope_type}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="NATIONAL">Nacional</option>
                <option value="REGIONAL">Regional</option>
                <option value="CITY">Ciudad/Municipio</option>
                <option value="DISTRICT">Distrito</option>
                <option value="CUSTOM">Personalizado</option>
              </select>
            </div>

            {(formData.scope_type === "CITY" || formData.scope_type === "DISTRICT") && (
              <>
                <div>
                  <label htmlFor="city_code" className="block text-sm font-medium text-gray-700">
                    CÃ³digo de Ciudad (INE)
                  </label>
                  <input
                    type="text"
                    id="city_code"
                    name="city_code"
                    value={formData.city_code}
                    onChange={handleChange}
                    placeholder="28079"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="city_name" className="block text-sm font-medium text-gray-700">
                    Nombre de Ciudad
                  </label>
                  <input
                    type="text"
                    id="city_name"
                    name="city_name"
                    value={formData.city_name}
                    onChange={handleChange}
                    placeholder="Madrid"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </>
            )}

            {formData.scope_type === "CUSTOM" && (
              <div>
                <label
                  htmlFor="custom_scope_description"
                  className="block text-sm font-medium text-gray-700"
                >
                  DescripciÃ³n del Ãmbito Personalizado
                </label>
                <textarea
                  id="custom_scope_description"
                  name="custom_scope_description"
                  value={formData.custom_scope_description}
                  onChange={handleChange}
                  rows={2}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* Approval Settings */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">ConfiguraciÃ³n de AprobaciÃ³n</h2>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="require_approval"
                name="require_approval"
                checked={formData.require_approval}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="require_approval" className="ml-2 block text-sm text-gray-700">
                Requiere aprobaciÃ³n externa
              </label>
            </div>

            {formData.require_approval && (
              <div>
                <label
                  htmlFor="approval_authority"
                  className="block text-sm font-medium text-gray-700"
                >
                  Autoridad de AprobaciÃ³n
                </label>
                <input
                  type="text"
                  id="approval_authority"
                  name="approval_authority"
                  value={formData.approval_authority}
                  onChange={handleChange}
                  placeholder="ej. Ayuntamiento de Madrid"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* Badge Settings */}
          <div className="space-y-4">
            <h2 className="text-lg font-medium text-gray-900">Badge de VerificaciÃ³n</h2>

            <div>
              <label htmlFor="badge_name" className="block text-sm font-medium text-gray-700">
                Nombre del Badge
              </label>
              <input
                type="text"
                id="badge_name"
                name="badge_name"
                value={formData.badge_name}
                onChange={handleChange}
                placeholder="ej. Verificado por SAMUR"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="badge_color" className="block text-sm font-medium text-gray-700">
                Color del Badge
              </label>
              <input
                type="color"
                id="badge_color"
                name="badge_color"
                value={formData.badge_color}
                onChange={handleChange}
                className="mt-1 block h-10 w-20 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <Link
              href="/admin/organizations"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Creando..." : "Crear OrganizaciÃ³n"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
