"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface FieldMapping {
  [key: string]: string;
}

interface ExistingDataSource {
  id: string;
  name: string;
  type: string;
  config: Record<string, unknown>;
  sourceOrigin: string;
  countryCode: string;
  regionCode: string;
}

const SOURCE_ORIGINS = [
  { value: "EXTERNAL_API", label: "API Externa" },
  { value: "HEALTH_API", label: "API de Salud" },
  { value: "CIVIL_PROTECTION_API", label: "API Protección Civil" },
  { value: "FIRE_DEPARTMENT_API", label: "API Bomberos" },
];

const COUNTRY_CODES = [
  { value: "ES", label: "España" },
  { value: "FR", label: "Francia" },
  { value: "IT", label: "Italia" },
  { value: "DE", label: "Alemania" },
  { value: "PT", label: "Portugal" },
  { value: "CH", label: "Suiza" },
  { value: "AT", label: "Austria" },
  { value: "BE", label: "Bélgica" },
  { value: "SI", label: "Eslovenia" },
  { value: "GB", label: "Reino Unido" },
  { value: "NL", label: "Países Bajos" },
  { value: "DK", label: "Dinamarca" },
  { value: "SE", label: "Suecia" },
  { value: "NO", label: "Noruega" },
];

const REGION_CODES_BY_COUNTRY: Record<string, Array<{ value: string; label: string }>> = {
  ES: [
    { value: "ES", label: "Nacional" },
    { value: "ES-AN", label: "Andalucía" },
    { value: "ES-AR", label: "Aragón" },
    { value: "ES-AS", label: "Asturias" },
    { value: "ES-IB", label: "Islas Baleares" },
    { value: "ES-CN", label: "Canarias" },
    { value: "ES-CB", label: "Cantabria" },
    { value: "ES-CL", label: "Castilla y León" },
    { value: "ES-CM", label: "Castilla-La Mancha" },
    { value: "ES-CT", label: "Cataluña" },
    { value: "ES-CE", label: "Ceuta" },
    { value: "ES-EX", label: "Extremadura" },
    { value: "ES-GA", label: "Galicia" },
    { value: "ES-MD", label: "Madrid" },
    { value: "ES-ML", label: "Melilla" },
    { value: "ES-MC", label: "Murcia" },
    { value: "ES-NC", label: "Navarra" },
    { value: "ES-PV", label: "País Vasco" },
    { value: "ES-RI", label: "La Rioja" },
    { value: "ES-VC", label: "Valencia" },
  ],
  FR: [
    { value: "FR", label: "Nacional" },
    { value: "FR-IDF", label: "Île-de-France" },
    { value: "FR-ARA", label: "Auvergne-Rhône-Alpes" },
    { value: "FR-OCC", label: "Occitanie" },
    { value: "FR-NAQ", label: "Nouvelle-Aquitaine" },
    { value: "FR-PDL", label: "Pays de la Loire" },
    { value: "FR-BRE", label: "Bretagne" },
    { value: "FR-GES", label: "Grand Est" },
    { value: "FR-HDF", label: "Hauts-de-France" },
    { value: "FR-NOR", label: "Normandie" },
    { value: "FR-CVL", label: "Centre-Val de Loire" },
    { value: "FR-BFC", label: "Bourgogne-Franche-Comté" },
    { value: "FR-PAC", label: "Provence-Alpes-Côte d'Azur" },
    { value: "FR-COR", label: "Corse" },
  ],
  IT: [
    { value: "IT", label: "Nacional" },
    { value: "IT-45", label: "Emilia-Romaña" },
    { value: "IT-25", label: "Lombardía" },
    { value: "IT-32", label: "Trentino-Alto Adigio" },
    { value: "IT-34", label: "Véneto" },
    { value: "IT-52", label: "Toscana" },
    { value: "IT-62", label: "Lacio" },
  ],
  DE: [
    { value: "DE", label: "Nacional" },
    { value: "DE-BY", label: "Bavaria" },
    { value: "DE-NW", label: "Nordrhein-Westfalen" },
    { value: "DE-BW", label: "Baden-Württemberg" },
    { value: "DE-NI", label: "Niedersachsen" },
    { value: "DE-HE", label: "Hessen" },
    { value: "DE-BE", label: "Berlin" },
    { value: "DE-HH", label: "Hamburg" },
  ],
  PT: [
    { value: "PT", label: "Nacional" },
    { value: "PT-11", label: "Lisboa" },
    { value: "PT-13", label: "Porto" },
  ],
  CH: [{ value: "CH", label: "Nacional" }],
  AT: [
    { value: "AT", label: "Nacional" },
    { value: "AT-9", label: "Wien" },
    { value: "AT-6", label: "Steiermark" },
  ],
  BE: [
    { value: "BE", label: "Nacional" },
    { value: "BE-BRU", label: "Bruxelles" },
    { value: "BE-VLG", label: "Vlaanderen" },
    { value: "BE-WAL", label: "Wallonie" },
  ],
  SI: [{ value: "SI", label: "Nacional" }],
  GB: [
    { value: "GB", label: "Nacional" },
    { value: "GB-ENG", label: "England" },
    { value: "GB-SCT", label: "Scotland" },
    { value: "GB-WLS", label: "Wales" },
    { value: "GB-NIR", label: "Northern Ireland" },
  ],
  NL: [{ value: "NL", label: "Nacional" }],
  DK: [{ value: "DK", label: "Nacional" }],
  SE: [{ value: "SE", label: "Nacional" }],
  NO: [{ value: "NO", label: "Nacional" }],
};

const PAGINATION_STRATEGIES = [
  { value: "none", label: "Sin paginación" },
  { value: "offset", label: "Offset (offset + limit)" },
  { value: "page", label: "Página (page + per_page)" },
  { value: "cursor", label: "Cursor (cursor + limit)" },
];

const EMPTY_FIELD_MAPPING: FieldMapping = {};

export default function NewDataSourcePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ExistingDataSource[]>([]);
  const [form, setForm] = useState({
    name: "",
    type: "JSON_FILE",
    description: "",
    // Para CKAN_API
    apiEndpoint: "",
    resourceId: "",
    // Para JSON_FILE
    fileUrl: "",
    jsonPath: "",
    // Para REST_API
    method: "GET" as "GET" | "POST",
    requestBody: "",
    responseDataPath: "",
    paginationStrategy: "none",
    paginationLimitParam: "limit",
    paginationLimitValue: "100",
    paginationOffsetParam: "offset",
    paginationPageParam: "page",
    paginationCursorParam: "cursor",
    paginationCursorResponsePath: "",
    paginationTotalCountPath: "",
    paginationHasMorePath: "",
    // Común
    syncFrequency: "MANUAL",
    defaultPublicationMode: "LOCATION_ONLY",
    isActive: true,
    sourceOrigin: "EXTERNAL_API",
    countryCode: "ES",
    regionCode: "ES-MD",
    fieldMapping: EMPTY_FIELD_MAPPING as FieldMapping,
  });

  // Load existing data sources as templates
  useEffect(() => {
    fetch("/api/admin/data-sources?asTemplates=true")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setTemplates(data.data);
        }
      })
      .catch(() => {
        // Silently fail — templates are optional
      });
  }, []);

  const availableRegions = useMemo(() => {
    const regions = REGION_CODES_BY_COUNTRY[form.countryCode];
    if (regions && regions.length > 0) return regions;
    // Fallback: show a generic "Nacional" option using country code
    const country = COUNTRY_CODES.find((c) => c.value === form.countryCode);
    return [{ value: form.countryCode, label: country?.label || form.countryCode }];
  }, [form.countryCode]);

  const loadFromTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;

    const config = template.config as Record<string, unknown>;
    setForm({
      ...form,
      type: template.type,
      sourceOrigin: template.sourceOrigin,
      countryCode: template.countryCode || "ES",
      regionCode: template.regionCode,
      apiEndpoint: (config.apiEndpoint as string) || "",
      resourceId: (config.resourceId as string) || "",
      fileUrl: (config.fileUrl as string) || "",
      jsonPath: (config.jsonPath as string) || "",
      responseDataPath: (config.responseDataPath as string) || "",
      fieldMapping: (config.fieldMapping || config.fieldMappings || {}) as FieldMapping,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError("El nombre es obligatorio");
      return;
    }

    if (form.type === "CKAN_API") {
      if (!form.apiEndpoint.trim()) {
        setError("El endpoint de la API es obligatorio para CKAN");
        return;
      }
      if (!form.resourceId.trim()) {
        setError("El Resource ID es obligatorio para CKAN");
        return;
      }
    }

    if (form.type === "JSON_FILE") {
      if (!form.fileUrl.trim()) {
        setError("La URL del archivo JSON es obligatoria");
        return;
      }
    }

    if (form.type === "REST_API") {
      if (!form.apiEndpoint.trim()) {
        setError("El endpoint de la API es obligatorio");
        return;
      }
    }

    try {
      setLoading(true);

      // Construir el objeto config según el tipo
      let config: Record<string, unknown> = {
        fieldMapping: form.fieldMapping,
      };

      if (form.type === "CKAN_API") {
        config = {
          ...config,
          apiEndpoint: form.apiEndpoint || null,
          resourceId: form.resourceId || null,
        };
      } else if (form.type === "JSON_FILE") {
        config = {
          ...config,
          fileUrl: form.fileUrl || null,
          jsonPath: form.jsonPath || null,
        };
      } else if (form.type === "REST_API") {
        config = {
          ...config,
          apiEndpoint: form.apiEndpoint || null,
          method: form.method,
          responseDataPath: form.responseDataPath || null,
        };

        if (form.method === "POST" && form.requestBody.trim()) {
          try {
            config.requestBody = JSON.parse(form.requestBody);
          } catch {
            setError("El cuerpo de la petición debe ser JSON válido");
            return;
          }
        }

        if (form.paginationStrategy !== "none") {
          const pagination: Record<string, unknown> = {
            strategy: form.paginationStrategy,
            limitParam: form.paginationLimitParam || "limit",
            limitValue: parseInt(form.paginationLimitValue, 10) || 100,
          };

          if (form.paginationStrategy === "offset") {
            pagination.offsetParam = form.paginationOffsetParam || "offset";
          } else if (form.paginationStrategy === "page") {
            pagination.pageParam = form.paginationPageParam || "page";
          } else if (form.paginationStrategy === "cursor") {
            pagination.cursorParam = form.paginationCursorParam || "cursor";
            if (form.paginationCursorResponsePath) {
              pagination.cursorResponsePath = form.paginationCursorResponsePath;
            }
          }

          if (form.paginationTotalCountPath) {
            pagination.totalCountPath = form.paginationTotalCountPath;
          }
          if (form.paginationHasMorePath) {
            pagination.hasMorePath = form.paginationHasMorePath;
          }

          config.pagination = pagination;
        }
      }

      const response = await fetch("/api/admin/data-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          description: form.description || null,
          syncFrequency: form.syncFrequency,
          defaultPublicationMode: form.defaultPublicationMode,
          isActive: form.isActive,
          sourceOrigin: form.sourceOrigin,
          countryCode: form.countryCode,
          regionCode: form.regionCode,
          config,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al crear la fuente de datos");
      }

      router.push(`/admin/data-sources/${data.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const updateFieldMapping = (field: string, value: string) => {
    setForm({
      ...form,
      fieldMapping: {
        ...form.fieldMapping,
        [field]: value,
      },
    });
  };

  const addFieldMapping = () => {
    setForm({
      ...form,
      fieldMapping: {
        ...form.fieldMapping,
        "": "",
      },
    });
  };

  const removeFieldMapping = (field: string) => {
    const updated = { ...form.fieldMapping };
    delete updated[field];
    setForm({ ...form, fieldMapping: updated });
  };

  const renameFieldMapping = (oldKey: string, newKey: string) => {
    if (oldKey === newKey) return;
    const updated: FieldMapping = {};
    for (const [k, v] of Object.entries(form.fieldMapping)) {
      updated[k === oldKey ? newKey : k] = v;
    }
    setForm({ ...form, fieldMapping: updated });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/data-sources"
            className="text-sm text-blue-600 hover:text-blue-800 mb-2 inline-block"
          >
            &larr; Volver a fuentes de datos
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Nueva Fuente de Datos</h1>
          <p className="mt-2 text-sm text-gray-600">
            Configura una nueva fuente de datos externa para importar DEAs automáticamente
          </p>
        </div>

        {/* Template loader */}
        {templates.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <label htmlFor="template" className="block text-sm font-medium text-blue-800 mb-2">
              Copiar configuración de una fuente existente
            </label>
            <select
              id="template"
              onChange={(e) => {
                if (e.target.value) loadFromTemplate(e.target.value);
              }}
              className="block w-full border-blue-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              defaultValue=""
            >
              <option value="">-- Seleccionar plantilla --</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.type})
                </option>
              ))}
            </select>
          </div>
        )}

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

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Información Básica</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Nombre *
                </label>
                <input
                  type="text"
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="ej. DEAs Comunidad de Madrid"
                />
              </div>

              <div>
                <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                  Tipo
                </label>
                <select
                  id="type"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="JSON_FILE">Archivo JSON</option>
                  <option value="REST_API">API REST</option>
                  <option value="CKAN_API">API CKAN</option>
                  <option value="CSV_FILE">Archivo CSV</option>
                </select>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  Descripción
                </label>
                <textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="Descripción de la fuente de datos..."
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="sourceOrigin" className="block text-sm font-medium text-gray-700">
                    Origen *
                  </label>
                  <select
                    id="sourceOrigin"
                    value={form.sourceOrigin}
                    onChange={(e) => setForm({ ...form, sourceOrigin: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    {SOURCE_ORIGINS.map((origin) => (
                      <option key={origin.value} value={origin.value}>
                        {origin.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="countryCode" className="block text-sm font-medium text-gray-700">
                    País *
                  </label>
                  <select
                    id="countryCode"
                    value={form.countryCode}
                    onChange={(e) => {
                      const newCountry = e.target.value;
                      const regions = REGION_CODES_BY_COUNTRY[newCountry];
                      const defaultRegion = regions?.[0]?.value || newCountry;
                      setForm({ ...form, countryCode: newCountry, regionCode: defaultRegion });
                    }}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    {COUNTRY_CODES.map((country) => (
                      <option key={country.value} value={country.value}>
                        {country.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="regionCode" className="block text-sm font-medium text-gray-700">
                    Región *
                  </label>
                  <select
                    id="regionCode"
                    value={form.regionCode}
                    onChange={(e) => setForm({ ...form, regionCode: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    {availableRegions.map((region) => (
                      <option key={region.value} value={region.value}>
                        {region.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="syncFrequency"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Frecuencia de Sincronización
                  </label>
                  <select
                    id="syncFrequency"
                    value={form.syncFrequency}
                    onChange={(e) => setForm({ ...form, syncFrequency: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="MANUAL">Manual</option>
                    <option value="DAILY">Diaria</option>
                    <option value="WEEKLY">Semanal</option>
                    <option value="MONTHLY">Mensual</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="defaultPublicationMode"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Modo de Publicación por Defecto
                  </label>
                  <select
                    id="defaultPublicationMode"
                    value={form.defaultPublicationMode}
                    onChange={(e) => setForm({ ...form, defaultPublicationMode: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="NONE">Ninguno - No publicar</option>
                    <option value="LOCATION_ONLY">Solo ubicación</option>
                    <option value="BASIC_INFO">Info básica (ubicación + horario + tipo)</option>
                    <option value="FULL">Información completa</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
                  Activar fuente de datos
                </label>
              </div>
            </div>
          </div>

          {/* JSON File Configuration */}
          {form.type === "JSON_FILE" && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Configuración de Archivo JSON
              </h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="fileUrl" className="block text-sm font-medium text-gray-700">
                    URL del archivo JSON *
                  </label>
                  <input
                    type="url"
                    id="fileUrl"
                    value={form.fileUrl}
                    onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="https://ejemplo.com/datos/deas.json"
                  />
                </div>

                <div>
                  <label htmlFor="jsonPath" className="block text-sm font-medium text-gray-700">
                    Ruta al array de datos
                  </label>
                  <input
                    type="text"
                    id="jsonPath"
                    value={form.jsonPath}
                    onChange={(e) => setForm({ ...form, jsonPath: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono"
                    placeholder="data"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Propiedad del JSON que contiene el array de registros. Ej: &quot;data&quot;,
                    &quot;records&quot;, &quot;result.items&quot;. Dejar vacío para auto-detectar.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CKAN API Configuration */}
          {form.type === "CKAN_API" && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Configuración de API CKAN</h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="apiEndpoint" className="block text-sm font-medium text-gray-700">
                    Endpoint de la API *
                  </label>
                  <input
                    type="url"
                    id="apiEndpoint"
                    value={form.apiEndpoint}
                    onChange={(e) => setForm({ ...form, apiEndpoint: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="https://datos.ejemplo.com"
                  />
                </div>

                <div>
                  <label htmlFor="resourceId" className="block text-sm font-medium text-gray-700">
                    Resource ID *
                  </label>
                  <input
                    type="text"
                    id="resourceId"
                    value={form.resourceId}
                    onChange={(e) => setForm({ ...form, resourceId: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono"
                    placeholder="fba1b963-3aa3-42d2-8316-1228d2be69c9"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Identificador único del recurso en el catálogo de datos
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* REST API Configuration */}
          {form.type === "REST_API" && (
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Configuración de API REST</h2>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="restApiEndpoint"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Endpoint de la API *
                  </label>
                  <input
                    type="url"
                    id="restApiEndpoint"
                    value={form.apiEndpoint}
                    onChange={(e) => setForm({ ...form, apiEndpoint: e.target.value })}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="https://api.ejemplo.com/v1/defibrillators"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="method" className="block text-sm font-medium text-gray-700">
                      Método HTTP
                    </label>
                    <select
                      id="method"
                      value={form.method}
                      onChange={(e) =>
                        setForm({ ...form, method: e.target.value as "GET" | "POST" })
                      }
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="responseDataPath"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Ruta de datos en respuesta
                    </label>
                    <input
                      type="text"
                      id="responseDataPath"
                      value={form.responseDataPath}
                      onChange={(e) => setForm({ ...form, responseDataPath: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono"
                      placeholder="results, data.records, elements"
                    />
                  </div>
                </div>

                {form.method === "POST" && (
                  <div>
                    <label
                      htmlFor="requestBody"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Cuerpo de la petición (JSON)
                    </label>
                    <textarea
                      id="requestBody"
                      value={form.requestBody}
                      onChange={(e) => setForm({ ...form, requestBody: e.target.value })}
                      rows={4}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono text-xs"
                      placeholder='{"query": "..."}'
                    />
                  </div>
                )}

                {/* Pagination */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium text-gray-900 mb-3">Paginación</h3>

                  <div>
                    <label
                      htmlFor="paginationStrategy"
                      className="block text-sm font-medium text-gray-700"
                    >
                      Estrategia
                    </label>
                    <select
                      id="paginationStrategy"
                      value={form.paginationStrategy}
                      onChange={(e) => setForm({ ...form, paginationStrategy: e.target.value })}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      {PAGINATION_STRATEGIES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {form.paginationStrategy !== "none" && (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600">
                          Parámetro de límite
                        </label>
                        <input
                          type="text"
                          value={form.paginationLimitParam}
                          onChange={(e) =>
                            setForm({ ...form, paginationLimitParam: e.target.value })
                          }
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm font-mono"
                          placeholder="limit"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600">
                          Registros por página
                        </label>
                        <input
                          type="number"
                          value={form.paginationLimitValue}
                          onChange={(e) =>
                            setForm({ ...form, paginationLimitValue: e.target.value })
                          }
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm"
                          placeholder="100"
                        />
                      </div>

                      {form.paginationStrategy === "offset" && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600">
                            Parámetro de offset
                          </label>
                          <input
                            type="text"
                            value={form.paginationOffsetParam}
                            onChange={(e) =>
                              setForm({ ...form, paginationOffsetParam: e.target.value })
                            }
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm font-mono"
                            placeholder="offset"
                          />
                        </div>
                      )}

                      {form.paginationStrategy === "page" && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600">
                            Parámetro de página
                          </label>
                          <input
                            type="text"
                            value={form.paginationPageParam}
                            onChange={(e) =>
                              setForm({ ...form, paginationPageParam: e.target.value })
                            }
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm font-mono"
                            placeholder="page"
                          />
                        </div>
                      )}

                      {form.paginationStrategy === "cursor" && (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-gray-600">
                              Parámetro de cursor
                            </label>
                            <input
                              type="text"
                              value={form.paginationCursorParam}
                              onChange={(e) =>
                                setForm({ ...form, paginationCursorParam: e.target.value })
                              }
                              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm font-mono"
                              placeholder="cursor"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600">
                              Ruta del cursor en respuesta
                            </label>
                            <input
                              type="text"
                              value={form.paginationCursorResponsePath}
                              onChange={(e) =>
                                setForm({ ...form, paginationCursorResponsePath: e.target.value })
                              }
                              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm font-mono"
                              placeholder="meta.next_cursor"
                            />
                          </div>
                        </>
                      )}

                      <div>
                        <label className="block text-xs font-medium text-gray-600">
                          Ruta del total de registros
                        </label>
                        <input
                          type="text"
                          value={form.paginationTotalCountPath}
                          onChange={(e) =>
                            setForm({ ...form, paginationTotalCountPath: e.target.value })
                          }
                          className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm font-mono"
                          placeholder="meta.total_count"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Field Mapping */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Mapeo de Campos</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Campo fuente &rarr; Campo del sistema. Deja vacío si no aplica.
                </p>
              </div>
              <button
                type="button"
                onClick={addFieldMapping}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                + Añadir campo
              </button>
            </div>

            {Object.keys(form.fieldMapping).length === 0 ? (
              <p className="text-sm text-gray-400 italic">
                Sin mapeo de campos configurado. Pulsa &quot;Añadir campo&quot; para empezar o copia
                desde una fuente existente.
              </p>
            ) : (
              <div className="space-y-2">
                {Object.entries(form.fieldMapping).map(([sourceField, systemField], index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={sourceField}
                      onChange={(e) => renameFieldMapping(sourceField, e.target.value)}
                      className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono text-xs"
                      placeholder="campo_fuente"
                    />
                    <span className="text-gray-400 text-xs">&rarr;</span>
                    <input
                      type="text"
                      value={systemField}
                      onChange={(e) => updateFieldMapping(sourceField, e.target.value)}
                      className="flex-1 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm font-mono text-xs"
                      placeholder="campo_sistema"
                    />
                    <button
                      type="button"
                      onClick={() => removeFieldMapping(sourceField)}
                      className="text-red-400 hover:text-red-600 text-sm"
                      title="Eliminar"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Link
              href="/admin/data-sources"
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white
                ${loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"}`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Creando...
                </>
              ) : (
                "Crear Fuente de Datos"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
