/**
 * Admin DEA Detail Page - EDITABLE VERSION
 * Complete management view for administrators with editing capabilities
 */

"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  MapPin,
  Image as ImageIcon,
  FileText,
  Users,
  Activity,
  CheckCircle,
  AlertCircle,
  XCircle,
  Edit2,
  Save,
  X,
  Trash2,
} from "lucide-react";

/**
 * Type for internal note structure
 */
interface InternalNote {
  text: string;
  author?: string;
  date?: string;
  type?: string;
}

/**
 * Type for DEA update payload sent to API
 */
interface DeaUpdatePayload extends Partial<AdminDeaData> {
  deleteImageIds?: string[];
}

/**
 * Type for field values that can be edited
 */
type EditableFieldValue = string | boolean | number | null;

interface AdminDeaData {
  id: string;
  code: string | null;
  provisional_number: number | null;
  name: string;
  status: string;
  establishment_type: string | null;

  // Geospatial
  latitude: number | null;
  longitude: number | null;
  coordinates_precision: string | null;

  // Origin and traceability
  source_origin: string;
  source_details: string | null;
  batch_job_id: string | null;
  external_reference: string | null;

  // Notes
  public_notes: string | null;
  internal_notes: InternalNote[] | null;
  rejection_reason: string | null;
  requires_attention: boolean;

  // Verification and accessibility
  last_verified_at: string | null;
  verification_method: string | null;
  is_publicly_accessible: boolean;
  installation_date: string | null;

  // Publication
  publication_mode: string;
  publication_requested_at: string | null;
  publication_approved_at: string | null;
  publication_approved_by: string | null;
  published_at: string | null;

  // Ownership
  owner_user_id: string | null;

  // Sequence
  sequence: number;

  // External data source
  data_source_id: string | null;
  last_synced_at: string | null;
  sync_content_hash: string | null;

  // Audit
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;

  // Relations
  location: {
    id: string;
    street_type: string | null;
    street_name: string | null;
    street_number: string | null;
    postal_code: string | null;
    city_name: string | null;
    city_code: string | null;
    district_code: string | null;
    district_name: string | null;
    neighborhood_code: string | null;
    neighborhood_name: string | null;
    floor: string | null;
    location_details: string | null;
    access_instructions: string | null;
  };
  schedule: {
    id: string;
    description: string | null;
    has_24h_surveillance: boolean;
    has_restricted_access: boolean;
    weekday_opening: string | null;
    weekday_closing: string | null;
    saturday_opening: string | null;
    saturday_closing: string | null;
    sunday_opening: string | null;
    sunday_closing: string | null;
    holidays_as_weekday: boolean;
    closed_on_holidays: boolean;
    closed_in_august: boolean;
    notes: string | null;
  } | null;
  responsible: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    alternative_phone: string | null;
    ownership: string | null;
    local_ownership: string | null;
    local_use: string | null;
    organization: string | null;
    position: string | null;
    department: string | null;
    notes: any;
  } | null;
  batch_job: any;
  data_source: {
    id: string;
    name: string;
    description: string | null;
  } | null;
  images: any[];
  status_changes: any[];
  publication_history: any[];
  field_changes: any[];
  validations: any[];
  assignments: any[];
  org_verifications: any[];
  change_proposals: any[];
  ownership_claims: any[];
}

export default function AdminDeaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<{
    aed: AdminDeaData;
    counts: any;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("general");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedData, setEditedData] = useState<Partial<AdminDeaData>>({});
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);

  const handleSave = async () => {
    if (!data) return;

    try {
      setIsSaving(true);
      setError(null);

      const updatePayload: DeaUpdatePayload = {
        ...editedData,
      };

      // Add images to delete if any
      if (imagesToDelete.length > 0) {
        updatePayload.deleteImageIds = imagesToDelete;
      }

      const response = await fetch(`/api/admin/deas/${params.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) {
        throw new Error("Error al guardar los cambios");
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || "Error al guardar");
      }

      // Reload data
      const refreshResponse = await fetch(`/api/admin/deas/${params.id}`);
      const refreshResult = await refreshResponse.json();

      if (refreshResult.success) {
        setData({
          aed: refreshResult.data,
          counts: refreshResult.counts,
        });
      }

      // Reset editing state
      setIsEditing(false);
      setEditedData({});
      setImagesToDelete([]);
      
      alert("Cambios guardados exitosamente");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al guardar";
      setError(errorMessage);
      alert("Error al guardar: " + errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleFieldChange = (field: string, value: EditableFieldValue) => {
    setEditedData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleDeleteImage = (imageId: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar esta imagen?")) {
      setImagesToDelete((prev) => [...prev, imageId]);
    }
  };

  const handleUndoDeleteImage = (imageId: string) => {
    setImagesToDelete((prev) => prev.filter((id) => id !== imageId));
  };

  const isImageMarkedForDeletion = (imageId: string) => {
    return imagesToDelete.includes(imageId);
  };

  const getCurrentValue = (field: string, defaultValue: any) => {
    return Object.hasOwn(editedData, field) ? editedData[field as keyof typeof editedData] : defaultValue;
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/admin/deas/${params.id}`);

        if (!response.ok) {
          throw new Error("Error al cargar los datos del DEA");
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || "Error desconocido");
        }

        setData({
          aed: result.data,
          counts: result.counts,
        });
      } catch (err: any) {
        setError(err.message || "Error desconocido");
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchData();
    }
  }, [params.id]);

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; color: string; icon: any }> = {
      PUBLISHED: { label: "Publicado", color: "bg-green-100 text-green-800", icon: CheckCircle },
      DRAFT: { label: "Borrador", color: "bg-gray-100 text-gray-800", icon: FileText },
      PENDING_REVIEW: {
        label: "Pendiente",
        color: "bg-yellow-100 text-yellow-800",
        icon: AlertCircle,
      },
      REJECTED: { label: "Rechazado", color: "bg-red-100 text-red-800", icon: XCircle },
      INACTIVE: { label: "Inactivo", color: "bg-gray-100 text-gray-600", icon: XCircle },
    };

    const badge = badges[status] || badges.DRAFT;
    const Icon = badge.icon;

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${badge.color}`}
      >
        <Icon className="w-4 h-4" />
        {badge.label}
      </span>
    );
  };

  const getPublicationModeBadge = (mode: string) => {
    const modes: Record<string, { label: string; color: string }> = {
      NONE: { label: "No visible", color: "bg-gray-100 text-gray-800" },
      LOCATION_ONLY: { label: "Solo ubicación", color: "bg-blue-100 text-blue-800" },
      BASIC_INFO: { label: "Info básica", color: "bg-purple-100 text-purple-800" },
      FULL: { label: "Info completa", color: "bg-green-100 text-green-800" },
    };

    const modeInfo = modes[mode] || modes.NONE;

    return (
      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${modeInfo.color}`}>
        {modeInfo.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando información del DEA...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error || "No se pudo cargar el DEA"}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const { aed, counts } = data;

  const tabs = [
    { id: "general", label: "General", icon: FileText },
    { id: "images", label: `Imágenes (${counts.images - imagesToDelete.length})`, icon: ImageIcon },
    { id: "verifications", label: `Verificaciones (${counts.verifications})`, icon: CheckCircle },
    { id: "assignments", label: `Asignaciones (${counts.active_assignments})`, icon: Users },
    { id: "history", label: "Histórico", icon: Activity },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Volver al listado</span>
            </button>

            <div className="flex items-center gap-3">
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Edit2 className="w-4 h-4" />
                  Editar
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditedData({});
                      setImagesToDelete([]);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    <X className="w-4 h-4" />
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Save className="w-4 h-4" />
                    {isSaving ? "Guardando..." : "Guardar"}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{aed.name}</h1>
              <div className="flex flex-wrap items-center gap-2">
                {aed.code && (
                  <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                    Código: {aed.code}
                  </span>
                )}
                {getStatusBadge(aed.status)}
                {getPublicationModeBadge(aed.publication_mode)}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 -mb-px">
            <div className="flex overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm whitespace-nowrap
                      ${
                        activeTab === tab.id
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
                      }
                    `}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* General Tab */}
        {activeTab === "general" && (
          <div className="space-y-6">
            {/* Basic Info Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Información Básica</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de establecimiento
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={getCurrentValue("establishment_type", aed.establishment_type || "")}
                      onChange={(e) => handleFieldChange("establishment_type", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ej: Centro Comercial, Hospital, etc."
                    />
                  ) : (
                    <p className="text-gray-900">{aed.establishment_type || "No especificado"}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Acceso público
                  </label>
                  {isEditing ? (
                    <select
                      value={getCurrentValue("is_publicly_accessible", aed.is_publicly_accessible) ? "true" : "false"}
                      onChange={(e) => handleFieldChange("is_publicly_accessible", e.target.value === "true")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="true">Sí</option>
                      <option value="false">No</option>
                    </select>
                  ) : (
                    <p className="text-gray-900">
                      {aed.is_publicly_accessible ? "Sí" : "No"}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                  {isEditing ? (
                    <select
                      value={getCurrentValue("status", aed.status)}
                      onChange={(e) => handleFieldChange("status", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="DRAFT">Borrador</option>
                      <option value="PENDING_REVIEW">Pendiente de revisión</option>
                      <option value="PUBLISHED">Publicado</option>
                      <option value="REJECTED">Rechazado</option>
                      <option value="INACTIVE">Inactivo</option>
                    </select>
                  ) : (
                    <div>{getStatusBadge(aed.status)}</div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Modo de publicación</label>
                  {isEditing ? (
                    <select
                      value={getCurrentValue("publication_mode", aed.publication_mode)}
                      onChange={(e) => handleFieldChange("publication_mode", e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="NONE">No visible</option>
                      <option value="LOCATION_ONLY">Solo ubicación</option>
                      <option value="BASIC_INFO">Info básica</option>
                      <option value="FULL">Info completa</option>
                    </select>
                  ) : (
                    <div>{getPublicationModeBadge(aed.publication_mode)}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Location Card - Complete Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Ubicación Completa</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                    <p className="text-gray-900">
                      {aed.location.street_type} {aed.location.street_name}{" "}
                      {aed.location.street_number}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Código Postal y Ciudad</label>
                    <p className="text-gray-900">
                      {aed.location.postal_code} - {aed.location.city_name}
                    </p>
                    {aed.location.city_code && (
                      <p className="text-sm text-gray-600">Código ciudad: {aed.location.city_code}</p>
                    )}
                  </div>
                  {aed.location.district_name && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Distrito</label>
                      <p className="text-gray-900">{aed.location.district_name}</p>
                      {aed.location.district_code && (
                        <p className="text-sm text-gray-600">Código: {aed.location.district_code}</p>
                      )}
                    </div>
                  )}
                  {aed.location.neighborhood_name && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Barrio</label>
                      <p className="text-gray-900">{aed.location.neighborhood_name}</p>
                      {aed.location.neighborhood_code && (
                        <p className="text-sm text-gray-600">Código: {aed.location.neighborhood_code}</p>
                      )}
                    </div>
                  )}
                  {aed.location.floor && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Planta/Nivel</label>
                      <p className="text-gray-900">{aed.location.floor}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Coordenadas</label>
                    {aed.latitude && aed.longitude ? (
                      <div className="space-y-1">
                        <p className="text-gray-900 font-mono text-sm">
                          {aed.latitude.toFixed(6)}, {aed.longitude.toFixed(6)}
                        </p>
                        {aed.coordinates_precision && (
                          <p className="text-sm text-gray-600">Precisión: {aed.coordinates_precision}</p>
                        )}
                        {/* Mapa preview usando OpenStreetMap */}
                        <div className="mt-2 relative rounded border border-gray-300 overflow-hidden">
                          <iframe
                            width="100%"
                            height="300"
                            frameBorder="0"
                            scrolling="no"
                            marginHeight={0}
                            marginWidth={0}
                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${aed.longitude - 0.01},${aed.latitude - 0.01},${aed.longitude + 0.01},${aed.latitude + 0.01}&layer=mapnik&marker=${aed.latitude},${aed.longitude}`}
                            style={{ border: 0 }}
                          />
                          <div className="absolute bottom-2 left-2 right-2 flex gap-2">
                            <a
                              href={`https://www.openstreetmap.org/?mlat=${aed.latitude}&mlon=${aed.longitude}#map=18/${aed.latitude}/${aed.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 px-3 py-1.5 bg-white/90 hover:bg-white text-sm text-blue-600 rounded shadow hover:shadow-md transition-all text-center"
                            >
                              Ver en OpenStreetMap
                            </a>
                            <a
                              href={`https://www.google.com/maps?q=${aed.latitude},${aed.longitude}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 px-3 py-1.5 bg-white/90 hover:bg-white text-sm text-blue-600 rounded shadow hover:shadow-md transition-all text-center"
                            >
                              Ver en Google Maps
                            </a>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-600 italic">No disponibles</p>
                    )}
                  </div>
                </div>
              </div>
              {aed.location.location_details && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Detalles de Ubicación</label>
                  <p className="text-gray-900 whitespace-pre-wrap">{aed.location.location_details}</p>
                </div>
              )}
              {aed.location.access_instructions && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instrucciones de Acceso</label>
                  <p className="text-gray-900 whitespace-pre-wrap">{aed.location.access_instructions}</p>
                </div>
              )}
            </div>

            {/* Schedule Card - Complete Information */}
            {aed.schedule && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Horarios de Disponibilidad</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {aed.schedule.has_24h_surveillance && (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-800">
                          24/7 Disponible
                        </span>
                      )}
                      {aed.schedule.has_restricted_access && (
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                          Acceso Restringido
                        </span>
                      )}
                    </div>
                    {aed.schedule.description && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                        <p className="text-gray-900">{aed.schedule.description}</p>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Horario Semanal</label>
                      <div className="space-y-2 text-sm">
                        {aed.schedule.weekday_opening && aed.schedule.weekday_closing ? (
                          <div className="flex justify-between">
                            <span className="text-gray-700">Lunes a Viernes:</span>
                            <span className="text-gray-900 font-medium">
                              {aed.schedule.weekday_opening} - {aed.schedule.weekday_closing}
                            </span>
                          </div>
                        ) : (
                          <div className="flex justify-between">
                            <span className="text-gray-700">Lunes a Viernes:</span>
                            <span className="text-gray-500 italic">No especificado</span>
                          </div>
                        )}
                        {aed.schedule.saturday_opening && aed.schedule.saturday_closing ? (
                          <div className="flex justify-between">
                            <span className="text-gray-700">Sábados:</span>
                            <span className="text-gray-900 font-medium">
                              {aed.schedule.saturday_opening} - {aed.schedule.saturday_closing}
                            </span>
                          </div>
                        ) : (
                          <div className="flex justify-between">
                            <span className="text-gray-700">Sábados:</span>
                            <span className="text-gray-500 italic">No especificado</span>
                          </div>
                        )}
                        {aed.schedule.sunday_opening && aed.schedule.sunday_closing ? (
                          <div className="flex justify-between">
                            <span className="text-gray-700">Domingos:</span>
                            <span className="text-gray-900 font-medium">
                              {aed.schedule.sunday_opening} - {aed.schedule.sunday_closing}
                            </span>
                          </div>
                        ) : (
                          <div className="flex justify-between">
                            <span className="text-gray-700">Domingos:</span>
                            <span className="text-gray-500 italic">No especificado</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Días Especiales</label>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          {aed.schedule.holidays_as_weekday ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : (
                            <XCircle className="w-4 h-4 text-gray-400" />
                          )}
                          <span className="text-gray-700">Festivos como día laborable</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {aed.schedule.closed_on_holidays ? (
                            <XCircle className="w-4 h-4 text-red-600" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          )}
                          <span className="text-gray-700">
                            {aed.schedule.closed_on_holidays ? "Cerrado en festivos" : "Abierto en festivos"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {aed.schedule.closed_in_august ? (
                            <XCircle className="w-4 h-4 text-red-600" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          )}
                          <span className="text-gray-700">
                            {aed.schedule.closed_in_august ? "Cerrado en agosto" : "Abierto en agosto"}
                          </span>
                        </div>
                      </div>
                    </div>
                    {aed.schedule.notes && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notas Adicionales</label>
                        <p className="text-gray-900 text-sm whitespace-pre-wrap">{aed.schedule.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Responsible Card - Complete Information */}
            {aed.responsible && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">Responsable y Titular</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Responsable</label>
                      <p className="text-gray-900 font-medium">{aed.responsible.name}</p>
                    </div>
                    {aed.responsible.organization && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Organización</label>
                        <p className="text-gray-900">{aed.responsible.organization}</p>
                      </div>
                    )}
                    {aed.responsible.position && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                        <p className="text-gray-900">{aed.responsible.position}</p>
                      </div>
                    )}
                    {aed.responsible.department && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                        <p className="text-gray-900">{aed.responsible.department}</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Información de Contacto</label>
                      <div className="space-y-1">
                        {aed.responsible.email && (
                          <p className="text-gray-900">
                            <span className="text-gray-600">Email:</span>{" "}
                            <a href={`mailto:${aed.responsible.email}`} className="text-blue-600 hover:underline">
                              {aed.responsible.email}
                            </a>
                          </p>
                        )}
                        {aed.responsible.phone && (
                          <p className="text-gray-900">
                            <span className="text-gray-600">Teléfono:</span>{" "}
                            <a href={`tel:${aed.responsible.phone}`} className="text-blue-600 hover:underline">
                              {aed.responsible.phone}
                            </a>
                          </p>
                        )}
                        {aed.responsible.alternative_phone && (
                          <p className="text-gray-900">
                            <span className="text-gray-600">Teléfono alternativo:</span>{" "}
                            <a href={`tel:${aed.responsible.alternative_phone}`} className="text-blue-600 hover:underline">
                              {aed.responsible.alternative_phone}
                            </a>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {aed.responsible.ownership && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Titularidad</label>
                      <p className="text-gray-900">{aed.responsible.ownership}</p>
                    </div>
                  )}
                  {aed.responsible.local_ownership && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Titularidad del Local</label>
                      <p className="text-gray-900">{aed.responsible.local_ownership}</p>
                    </div>
                  )}
                  {aed.responsible.local_use && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Uso del Local</label>
                      <p className="text-gray-900">{aed.responsible.local_use}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Origin and Traceability Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Origen y Trazabilidad</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Origen de los Datos</label>
                    <p className="text-gray-900">{aed.source_origin.replace(/_/g, " ")}</p>
                    {aed.source_details && (
                      <p className="text-sm text-gray-600 mt-1">{aed.source_details}</p>
                    )}
                  </div>
                  {aed.external_reference && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Referencia Externa</label>
                      <p className="text-gray-900 font-mono text-sm">{aed.external_reference}</p>
                    </div>
                  )}
                  {aed.batch_job && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Lote de Importación</label>
                      <p className="text-gray-900 font-mono text-xs">{aed.batch_job_id}</p>
                    </div>
                  )}
                  {aed.data_source && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fuente de Datos</label>
                      <p className="text-gray-900">{aed.data_source.name}</p>
                      {aed.last_synced_at && (
                        <p className="text-sm text-gray-600">
                          Última sincronización:{" "}
                          {new Date(aed.last_synced_at).toLocaleString("es-ES")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Verificación</label>
                    {aed.last_verified_at ? (
                      <div>
                        <p className="text-gray-900">
                          {new Date(aed.last_verified_at).toLocaleDateString("es-ES", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                        {aed.verification_method && (
                          <p className="text-sm text-gray-600">Método: {aed.verification_method}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-gray-600 italic">Sin verificar</p>
                    )}
                  </div>
                  {aed.installation_date && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de Instalación</label>
                      <p className="text-gray-900">
                        {new Date(aed.installation_date).toLocaleDateString("es-ES", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Metadatos</label>
                    <div className="space-y-1 text-sm">
                      <p className="text-gray-600">
                        Creado: {new Date(aed.created_at).toLocaleString("es-ES")}
                      </p>
                      <p className="text-gray-600">
                        Actualizado: {new Date(aed.updated_at).toLocaleString("es-ES")}
                      </p>
                      {aed.sequence && (
                        <p className="text-gray-600">Secuencia: #{aed.sequence}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Notes Card */}
            {(aed.public_notes || aed.internal_notes || aed.rejection_reason || aed.requires_attention) && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Notas y Observaciones</h2>
                <div className="space-y-4">
                  {aed.requires_attention && (
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-5 h-5 text-yellow-600" />
                        <span className="font-medium text-yellow-900">Requiere Atención</span>
                      </div>
                    </div>
                  )}
                  {aed.rejection_reason && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <label className="block text-sm font-medium text-red-900 mb-1">Motivo de Rechazo</label>
                      <p className="text-red-800">{aed.rejection_reason}</p>
                    </div>
                  )}
                  {aed.public_notes && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notas Públicas</label>
                      <p className="text-gray-900 whitespace-pre-wrap">{aed.public_notes}</p>
                    </div>
                  )}
                  {aed.internal_notes && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Notas Internas</label>
                      <div className="text-gray-900 text-sm">
                        {Array.isArray(aed.internal_notes) ? (
                          <div className="space-y-2">
                            {aed.internal_notes.map((note: any, idx: number) => (
                              <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
                                <p className="whitespace-pre-wrap">{note.text || note}</p>
                                {note.author && (
                                  <p className="text-xs text-gray-600 mt-1">Por: {note.author}</p>
                                )}
                                {note.date && (
                                  <p className="text-xs text-gray-600">
                                    {new Date(note.date).toLocaleString("es-ES")}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="whitespace-pre-wrap">{JSON.stringify(aed.internal_notes)}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Images Tab with Delete Functionality */}
        {activeTab === "images" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Imágenes ({aed.images.length - imagesToDelete.length})
            </h2>
            {aed.images.length === 0 ? (
              <div className="text-center py-12">
                <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No hay imágenes disponibles</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {aed.images.map((image: any) => {
                  const markedForDeletion = isImageMarkedForDeletion(image.id);
                  return (
                    <div
                      key={image.id}
                      className={`relative group ${markedForDeletion ? "opacity-50" : ""}`}
                    >
                      <img
                        src={image.processed_url || image.original_url}
                        alt={image.type}
                        className="w-full h-40 object-cover rounded-lg border-2 border-gray-200"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-lg flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 text-white text-sm">
                          {image.type}
                        </div>
                      </div>
                      {image.is_verified && !markedForDeletion && (
                        <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                          <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                      )}
                      {isEditing && (
                        <div className="absolute top-2 left-2">
                          {markedForDeletion ? (
                            <button
                              onClick={() => handleUndoDeleteImage(image.id)}
                              className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 shadow-lg transition-colors"
                              title="Deshacer eliminación"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleDeleteImage(image.id)}
                              className="bg-red-500 hover:bg-red-600 text-white rounded-full p-2 shadow-lg transition-colors"
                              title="Eliminar imagen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )}
                      {markedForDeletion && (
                        <div className="absolute inset-0 flex items-center justify-center bg-red-500 bg-opacity-75 rounded-lg">
                          <span className="text-white font-semibold text-sm">
                            Se eliminará
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Other tabs remain the same - Ver, Assign, History */}
        {activeTab === "verifications" && (
          <div className="space-y-6">
            {/* Organization Verifications */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Verificaciones de Organización ({aed.org_verifications.length})
              </h2>
              {aed.org_verifications.length === 0 ? (
                <p className="text-sm text-gray-500 italic">Sin verificaciones de organización</p>
              ) : (
                <div className="space-y-4">
                  {aed.org_verifications.map((verification: any) => (
                    <div key={verification.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">
                            {verification.organization.name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {new Date(verification.verified_at).toLocaleDateString("es-ES", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </p>
                        </div>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {verification.verification_type}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {verification.verified_photos && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Fotos</span>
                        )}
                        {verification.verified_address && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Dirección</span>
                        )}
                        {verification.verified_schedule && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Horario</span>
                        )}
                        {verification.verified_access && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Acceso</span>
                        )}
                        {verification.verified_signage && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Señalización</span>
                        )}
                      </div>
                      {verification.notes && (
                        <p className="text-sm text-gray-600 mt-2">{verification.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Photo Validations (from /verify flow) */}
            {aed.validations && aed.validations.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Validaciones Fotográficas ({aed.validations.length})
                </h2>
                <div className="space-y-4">
                  {aed.validations.map((validation: any) => {
                    const result = validation.result as any;
                    return (
                      <div key={validation.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-gray-900">
                              Validación de imágenes
                            </p>
                            <p className="text-sm text-gray-600">
                              {validation.completed_at
                                ? new Date(validation.completed_at).toLocaleDateString("es-ES", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : new Date(validation.started_at).toLocaleDateString("es-ES", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })}
                            </p>
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              validation.status === "COMPLETED"
                                ? "bg-green-100 text-green-800"
                                : validation.status === "IN_PROGRESS"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {validation.status === "COMPLETED"
                              ? "Completada"
                              : validation.status === "IN_PROGRESS"
                                ? "En progreso"
                                : validation.status}
                          </span>
                        </div>
                        {result?.processed_images_count != null && (
                          <p className="text-sm text-gray-600">
                            {result.processed_images_count} imagen(es) procesada(s)
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {aed.org_verifications.length === 0 && (!aed.validations || aed.validations.length === 0) && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No hay verificaciones registradas</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "assignments" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Asignaciones ({aed.assignments.length})
            </h2>
            {aed.assignments.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No hay asignaciones</p>
              </div>
            ) : (
              <div className="space-y-4">
                {aed.assignments.map((assignment: any) => (
                  <div key={assignment.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900">{assignment.organization.name}</p>
                        <p className="text-sm text-gray-600">{assignment.assignment_type}</p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          assignment.status === "ACTIVE"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {assignment.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Asignado:{" "}
                      {new Date(assignment.assigned_at).toLocaleDateString("es-ES", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Cambios de Estado ({aed.status_changes.length})
              </h2>
              {aed.status_changes.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No hay cambios de estado</p>
              ) : (
                <div className="space-y-3">
                  {aed.status_changes.slice(0, 10).map((change: any) => (
                    <div key={change.id} className="flex items-start gap-3 border-l-2 border-gray-200 pl-3">
                      <Activity className="w-4 h-4 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{change.previous_status || "INICIAL"}</span>
                          {" → "}
                          <span className="font-medium">{change.new_status}</span>
                        </p>
                        <p className="text-xs text-gray-600">
                          {new Date(change.created_at).toLocaleString("es-ES")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Cambios de Campos ({counts.field_changes})
              </h2>
              {aed.field_changes.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No hay cambios registrados</p>
              ) : (
                <div className="space-y-3">
                  {aed.field_changes.slice(0, 15).map((change: any) => (
                    <div key={change.id} className="flex items-start gap-3 border-l-2 border-blue-200 pl-3">
                      <Edit2 className="w-4 h-4 text-blue-400 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{change.field_name}</span>
                        </p>
                        <p className="text-xs text-gray-600">
                          {new Date(change.changed_at).toLocaleString("es-ES")}
                        </p>
                        <div className="mt-1 text-xs">
                          <span className="text-red-600 line-through">
                            {change.old_value || "(vacío)"}
                          </span>
                          {" → "}
                          <span className="text-green-600">{change.new_value || "(vacío)"}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
