/**
 * Admin DEA Detail Page - FULLY EDITABLE VERSION
 * Complete management view for administrators with editing capabilities
 * for ALL fields: general, location, schedule, responsible, images, notes
 * All changes tracked in AedFieldChange audit trail
 */

"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
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
  Plus,
  Clock,
  Upload,
  Eye,
  Scissors,
  Loader2,
  RefreshCw,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { ImageProcessingResult } from "@/components/dea/DeaImageProcessor";

// Lazy-load to avoid SSR issues with canvas/leaflet
const DeaImageProcessor = dynamic(
  () => import("@/components/dea/DeaImageProcessor"),
  { ssr: false }
);

// ── Types ──────────────────────────────────────────────────────────────

interface InternalNote {
  text: string;
  author?: string;
  date?: string;
  type?: string;
}

interface LocationData {
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
}

interface ScheduleData {
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
}

interface ResponsibleData {
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
  notes: unknown;
}

interface AdminDeaData {
  id: string;
  code: string | null;
  provisional_number: number | null;
  name: string;
  status: string;
  establishment_type: string | null;
  latitude: number | null;
  longitude: number | null;
  coordinates_precision: string | null;
  source_origin: string;
  source_details: string | null;
  batch_job_id: string | null;
  external_reference: string | null;
  public_notes: string | null;
  internal_notes: InternalNote[] | null;
  rejection_reason: string | null;
  requires_attention: boolean;
  last_verified_at: string | null;
  verification_method: string | null;
  is_publicly_accessible: boolean;
  installation_date: string | null;
  publication_mode: string;
  publication_requested_at: string | null;
  publication_approved_at: string | null;
  publication_approved_by: string | null;
  published_at: string | null;
  owner_user_id: string | null;
  sequence: number;
  data_source_id: string | null;
  last_synced_at: string | null;
  sync_content_hash: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  location: LocationData;
  schedule: ScheduleData | null;
  responsible: ResponsibleData | null;
  batch_job: unknown;
  data_source: { id: string; name: string; description: string | null } | null;
  images: Array<{
    id: string;
    type: string;
    order: number;
    original_url: string;
    processed_url: string | null;
    is_verified: boolean;
    verified_at: string | null;
  }>;
  status_changes: Array<{
    id: string;
    previous_status: string | null;
    new_status: string;
    reason: string | null;
    modified_by: string | null;
    created_at: string;
  }>;
  publication_history: unknown[];
  field_changes: Array<{
    id: string;
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    changed_by: string;
    changed_at: string;
    change_source: string;
  }>;
  validations: unknown[];
  assignments: Array<{
    id: string;
    assignment_type: string;
    status: string;
    assigned_at: string;
    organization: { name: string };
  }>;
  org_verifications: Array<{
    id: string;
    verification_type: string;
    verified_at: string;
    verified_photos: boolean;
    verified_address: boolean;
    verified_schedule: boolean;
    verified_access: boolean;
    verified_signage: boolean;
    notes: string | null;
    organization: { name: string };
  }>;
  change_proposals: unknown[];
  ownership_claims: unknown[];
}

interface NewImage {
  url: string; // data: URL for preview (original)
  type: string;
  order: number;
  file?: File;
  /** If image was processed via crop/blur/arrow pipeline */
  processingResult?: ImageProcessingResult;
  /** Preview URL after processing (from ArrowPlacer) */
  processedPreviewUrl?: string;
}

/** State for the image processor modal */
interface ImageProcessorState {
  isOpen: boolean;
  /** URL of the image being processed */
  imageUrl: string;
  /** ID of existing image (null for new uploads) */
  imageId: string | null;
  /** Label for the modal header */
  label: string;
  /** Index in newImages array (for new uploads) */
  newImageIndex: number | null;
  /** Image type */
  imageType: string;
}

// ── Reusable UI Components ─────────────────────────────────────────────

function EditableField({
  label,
  value,
  onChange,
  isEditing,
  type = "text",
  placeholder,
  options,
  displayValue,
  multiline = false,
}: {
  label: string;
  value: string | number | boolean | null;
  onChange: (val: string | boolean | number | null) => void;
  isEditing: boolean;
  type?: "text" | "number" | "select" | "checkbox" | "time" | "date" | "textarea";
  placeholder?: string;
  options?: { value: string; label: string }[];
  displayValue?: string;
  multiline?: boolean;
}) {
  if (!isEditing) {
    if (type === "checkbox") {
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
          <div className="flex items-center gap-2">
            {value ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <XCircle className="w-4 h-4 text-gray-400" />
            )}
            <span className="text-gray-900">{value ? "Sí" : "No"}</span>
          </div>
        </div>
      );
    }
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <p className="text-gray-900">{displayValue || (value != null && value !== "" ? String(value) : <span className="text-gray-400 italic">No especificado</span>)}</p>
      </div>
    );
  }

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";

  if (type === "select" && options) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <select
          value={value != null ? String(value) : ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (type === "checkbox") {
    return (
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">{label}</span>
        </label>
      </div>
    );
  }

  if (type === "textarea" || multiline) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <textarea
          value={value != null ? String(value) : ""}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={placeholder}
          rows={3}
          className={inputClass}
        />
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={value != null ? String(value) : ""}
        onChange={(e) => {
          if (type === "number") {
            onChange(e.target.value === "" ? null : Number(e.target.value));
          } else {
            onChange(e.target.value || null);
          }
        }}
        placeholder={placeholder}
        className={inputClass}
      />
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────

export default function AdminDeaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<{ aed: AdminDeaData; counts: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("general");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Edit state for each section
  const [editedAed, setEditedAed] = useState<Record<string, unknown>>({});
  const [editedLocation, setEditedLocation] = useState<Record<string, unknown>>({});
  const [editedSchedule, setEditedSchedule] = useState<Record<string, unknown>>({});
  const [editedResponsible, setEditedResponsible] = useState<Record<string, unknown>>({});
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
  const [newImages, setNewImages] = useState<NewImage[]>([]);

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Image processor modal
  const [imageProcessor, setImageProcessor] = useState<ImageProcessorState>({
    isOpen: false, imageUrl: "", imageId: null, label: "", newImageIndex: null, imageType: "FRONT",
  });
  const [processingImageId, setProcessingImageId] = useState<string | null>(null);

  // Image upload ref
  const imageInputRef = useRef<HTMLInputElement>(null);

  // ── Data fetching ──
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/admin/deas/${params.id}`);
      if (!response.ok) throw new Error("Error al cargar los datos del DEA");
      const result = await response.json();
      if (!result.success) throw new Error(result.error || "Error desconocido");
      setData({ aed: result.data, counts: result.counts });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (params.id) fetchData();
  }, [params.id, fetchData]);

  // ── Edit handlers ──
  const handleAedChange = (field: string, value: unknown) => {
    setEditedAed((prev) => ({ ...prev, [field]: value }));
  };

  const handleLocationChange = (field: string, value: unknown) => {
    setEditedLocation((prev) => ({ ...prev, [field]: value }));
  };

  const handleScheduleChange = (field: string, value: unknown) => {
    setEditedSchedule((prev) => ({ ...prev, [field]: value }));
  };

  const handleResponsibleChange = (field: string, value: unknown) => {
    setEditedResponsible((prev) => ({ ...prev, [field]: value }));
  };

  const getAedValue = (field: string) => {
    if (field in editedAed) return editedAed[field];
    if (!data) return null;
    return (data.aed as unknown as Record<string, unknown>)[field];
  };

  const getLocationValue = (field: string) => {
    if (field in editedLocation) return editedLocation[field];
    if (!data) return null;
    return (data.aed.location as unknown as Record<string, unknown>)[field];
  };

  const getScheduleValue = (field: string) => {
    if (field in editedSchedule) return editedSchedule[field];
    if (!data?.aed.schedule) return null;
    return (data.aed.schedule as unknown as Record<string, unknown>)[field];
  };

  const getResponsibleValue = (field: string) => {
    if (field in editedResponsible) return editedResponsible[field];
    if (!data?.aed.responsible) return null;
    return (data.aed.responsible as unknown as Record<string, unknown>)[field];
  };

  // ── Image handling ──
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setNewImages((prev) => [
          ...prev,
          {
            url: reader.result as string,
            type: "FRONT",
            order: (data?.aed.images.length || 0) + prev.length + 1,
            file,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });
    // Reset input
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleNewImageTypeChange = (index: number, type: string) => {
    setNewImages((prev) => prev.map((img, i) => (i === index ? { ...img, type } : img)));
  };

  const handleRemoveNewImage = (index: number) => {
    setNewImages((prev) => prev.filter((_, i) => i !== index));
  };

  // ── Image processing ──

  /** Open processor for an existing image (reprocess from original) */
  const handleProcessExistingImage = (image: { id: string; original_url: string; type: string }) => {
    setImageProcessor({
      isOpen: true,
      imageUrl: image.original_url,
      imageId: image.id,
      label: imageTypeOptions.find((o) => o.value === image.type)?.label || image.type,
      newImageIndex: null,
      imageType: image.type,
    });
  };

  /** Open processor for a newly uploaded image */
  const handleProcessNewImage = (index: number) => {
    const img = newImages[index];
    if (!img) return;
    setImageProcessor({
      isOpen: true,
      imageUrl: img.url,
      imageId: null,
      label: `Nueva imagen (${imageTypeOptions.find((o) => o.value === img.type)?.label || img.type})`,
      newImageIndex: index,
      imageType: img.type,
    });
  };

  /** Handle completion of image processing pipeline */
  const handleProcessingComplete = async (result: ImageProcessingResult | null) => {
    setImageProcessor((prev) => ({ ...prev, isOpen: false }));

    if (!result) return;

    if (imageProcessor.imageId) {
      // ── Reprocess existing image: send to server API ──
      setProcessingImageId(imageProcessor.imageId);
      try {
        const response = await fetch(`/api/admin/deas/${params.id}/process-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageId: imageProcessor.imageId,
            imageType: imageProcessor.imageType,
            cropData: result.cropData,
            blurAreas: result.blurAreas,
            arrowData: result.arrowData,
          }),
        });

        const apiResult = await response.json();
        if (!response.ok || !apiResult.success) {
          throw new Error(apiResult.message || "Error al procesar imagen");
        }

        // Refresh data to show updated image
        await fetchData();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al procesar imagen");
      } finally {
        setProcessingImageId(null);
      }
    } else if (imageProcessor.newImageIndex !== null) {
      // ── Process new upload: store result, will be sent on save ──
      setNewImages((prev) =>
        prev.map((img, i) =>
          i === imageProcessor.newImageIndex
            ? {
                ...img,
                processingResult: result,
                processedPreviewUrl: result.previewUrl || img.url,
              }
            : img
        )
      );
    }
  };

  const handleProcessingCancel = () => {
    setImageProcessor((prev) => ({ ...prev, isOpen: false }));
  };

  // ── Cancel editing ──
  const handleCancel = () => {
    setIsEditing(false);
    setEditedAed({});
    setEditedLocation({});
    setEditedSchedule({});
    setEditedResponsible({});
    setImagesToDelete([]);
    setNewImages([]);
  };

  // ── Save ──
  const handleSave = async () => {
    if (!data) return;

    try {
      setIsSaving(true);
      setError(null);

      const payload: Record<string, unknown> = {};

      // AED-level fields
      if (Object.keys(editedAed).length > 0) {
        Object.assign(payload, editedAed);
      }

      // Location
      if (Object.keys(editedLocation).length > 0) {
        payload.location = editedLocation;
      }

      // Schedule
      if (Object.keys(editedSchedule).length > 0) {
        payload.schedule = editedSchedule;
      }

      // Responsible
      if (Object.keys(editedResponsible).length > 0) {
        payload.responsible = editedResponsible;
      }

      // Images to delete
      if (imagesToDelete.length > 0) {
        payload.deleteImageIds = imagesToDelete;
      }

      // New images: split into processed (go via process-image API) and unprocessed (go via PATCH)
      const processedNewImages = newImages.filter((img) => img.processingResult);
      const unprocessedNewImages = newImages.filter((img) => !img.processingResult);

      if (unprocessedNewImages.length > 0) {
        payload.addImages = unprocessedNewImages.map((img) => ({
          url: img.url,
          type: img.type,
          order: img.order,
        }));
      }

      // 1. Save general fields via PATCH
      const response = await fetch(`/api/admin/deas/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || "Error al guardar");
      }

      // 2. Process new images that went through crop/blur/arrow pipeline
      for (const img of processedNewImages) {
        const procResult = img.processingResult!;
        const procResponse = await fetch(`/api/admin/deas/${params.id}/process-image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            newImageDataUrl: img.url,
            imageType: img.type,
            cropData: procResult.cropData,
            blurAreas: procResult.blurAreas,
            arrowData: procResult.arrowData,
          }),
        });

        const procApiResult = await procResponse.json();
        if (!procResponse.ok || !procApiResult.success) {
          console.error("Error processing new image:", procApiResult);
        }
      }

      // Reload data
      await fetchData();

      // Reset editing state
      handleCancel();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error al guardar";
      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Badge helpers ──
  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
      PUBLISHED: { label: "Publicado", color: "bg-green-100 text-green-800", icon: CheckCircle },
      DRAFT: { label: "Borrador", color: "bg-gray-100 text-gray-800", icon: FileText },
      PENDING_REVIEW: { label: "Pendiente", color: "bg-yellow-100 text-yellow-800", icon: AlertCircle },
      REJECTED: { label: "Rechazado", color: "bg-red-100 text-red-800", icon: XCircle },
      INACTIVE: { label: "Inactivo", color: "bg-gray-100 text-gray-600", icon: XCircle },
    };
    const badge = badges[status] || badges.DRAFT;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${badge.color}`}>
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

  // ── Loading and error states ──

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

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error || "No se pudo cargar el DEA"}</p>
          <button onClick={() => router.back()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Volver
          </button>
        </div>
      </div>
    );
  }

  const { aed, counts } = data;

  const hasChanges =
    Object.keys(editedAed).length > 0 ||
    Object.keys(editedLocation).length > 0 ||
    Object.keys(editedSchedule).length > 0 ||
    Object.keys(editedResponsible).length > 0 ||
    imagesToDelete.length > 0 ||
    newImages.length > 0;

  const tabs = [
    { id: "general", label: "General", icon: FileText },
    { id: "images", label: `Imágenes (${aed.images.length - imagesToDelete.length + newImages.length})`, icon: ImageIcon },
    { id: "verifications", label: `Verificaciones (${counts.verifications})`, icon: CheckCircle },
    { id: "assignments", label: `Asignaciones (${counts.active_assignments})`, icon: Users },
    { id: "history", label: "Histórico", icon: Activity },
  ];

  const imageTypeOptions = [
    { value: "FRONT", label: "Frontal" },
    { value: "LOCATION", label: "Ubicación" },
    { value: "ACCESS", label: "Acceso" },
    { value: "SIGNAGE", label: "Señalización" },
    { value: "CONTEXT", label: "Contexto" },
    { value: "PLATE", label: "Placa" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Image Processor Modal */}
      {imageProcessor.isOpen && (
        <DeaImageProcessor
          imageUrl={imageProcessor.imageUrl}
          imageId={imageProcessor.imageId || undefined}
          imageLabel={imageProcessor.label}
          onComplete={handleProcessingComplete}
          onCancel={handleProcessingCancel}
        />
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <img src={lightboxUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg" />
          <button
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/40 text-white rounded-full p-2"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

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
              {saveSuccess && (
                <span className="text-green-600 text-sm font-medium flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Guardado
                </span>
              )}
              {error && isEditing && (
                <span className="text-red-600 text-sm font-medium max-w-xs truncate">{error}</span>
              )}
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
                    onClick={handleCancel}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    <X className="w-4 h-4" />
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !hasChanges}
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
              {isEditing ? (
                <input
                  type="text"
                  value={getAedValue("name") as string || ""}
                  onChange={(e) => handleAedChange("name", e.target.value)}
                  className="text-2xl font-bold text-gray-900 mb-2 border-b-2 border-blue-300 focus:border-blue-600 outline-none bg-transparent w-full"
                />
              ) : (
                <h1 className="text-2xl font-bold text-gray-900 mb-2">{aed.name}</h1>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {isEditing ? (
                  <input
                    type="text"
                    value={getAedValue("code") as string || ""}
                    onChange={(e) => handleAedChange("code", e.target.value || null)}
                    placeholder="Código"
                    className="text-sm bg-gray-100 px-2 py-1 rounded border border-gray-300 focus:ring-2 focus:ring-blue-500 w-40"
                  />
                ) : (
                  aed.code && (
                    <span className="text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded">
                      Código: {aed.code}
                    </span>
                  )
                )}
                {getStatusBadge(getAedValue("status") as string || aed.status)}
                {getPublicationModeBadge(getAedValue("publication_mode") as string || aed.publication_mode)}
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
                    className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm whitespace-nowrap ${
                      activeTab === tab.id
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
                    }`}
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
        {/* ════════════════════ GENERAL TAB ════════════════════ */}
        {activeTab === "general" && (
          <div className="space-y-6">
            {/* Basic Info Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Información Básica</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <EditableField
                  label="Tipo de establecimiento"
                  value={getAedValue("establishment_type") as string | null}
                  onChange={(v) => handleAedChange("establishment_type", v)}
                  isEditing={isEditing}
                  placeholder="Ej: Centro Comercial, Hospital"
                />
                <EditableField
                  label="Estado"
                  value={getAedValue("status") as string}
                  onChange={(v) => handleAedChange("status", v)}
                  isEditing={isEditing}
                  type="select"
                  options={[
                    { value: "DRAFT", label: "Borrador" },
                    { value: "PENDING_REVIEW", label: "Pendiente de revisión" },
                    { value: "PUBLISHED", label: "Publicado" },
                    { value: "REJECTED", label: "Rechazado" },
                    { value: "INACTIVE", label: "Inactivo" },
                  ]}
                  displayValue={getStatusBadge(aed.status) as unknown as string}
                />
                <EditableField
                  label="Modo de publicación"
                  value={getAedValue("publication_mode") as string}
                  onChange={(v) => handleAedChange("publication_mode", v)}
                  isEditing={isEditing}
                  type="select"
                  options={[
                    { value: "NONE", label: "No visible" },
                    { value: "LOCATION_ONLY", label: "Solo ubicación" },
                    { value: "BASIC_INFO", label: "Info básica" },
                    { value: "FULL", label: "Info completa" },
                  ]}
                />
                <EditableField
                  label="Acceso público"
                  value={getAedValue("is_publicly_accessible") as boolean}
                  onChange={(v) => handleAedChange("is_publicly_accessible", v)}
                  isEditing={isEditing}
                  type="checkbox"
                />
                <EditableField
                  label="Número provisional"
                  value={getAedValue("provisional_number") as number | null}
                  onChange={(v) => handleAedChange("provisional_number", v)}
                  isEditing={isEditing}
                  type="number"
                />
                <EditableField
                  label="Fecha de instalación"
                  value={getAedValue("installation_date") ? String(getAedValue("installation_date")).split("T")[0] : null}
                  onChange={(v) => handleAedChange("installation_date", v ? new Date(v as string).toISOString() : null)}
                  isEditing={isEditing}
                  type="date"
                  displayValue={aed.installation_date ? new Date(aed.installation_date).toLocaleDateString("es-ES") : undefined}
                />
                <EditableField
                  label="Requiere atención"
                  value={getAedValue("requires_attention") as boolean}
                  onChange={(v) => handleAedChange("requires_attention", v)}
                  isEditing={isEditing}
                  type="checkbox"
                />
              </div>
            </div>

            {/* Location Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Ubicación</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <EditableField
                  label="Tipo de vía"
                  value={getLocationValue("street_type") as string | null}
                  onChange={(v) => handleLocationChange("street_type", v)}
                  isEditing={isEditing}
                  placeholder="Calle, Avenida, Plaza..."
                />
                <EditableField
                  label="Nombre de la vía"
                  value={getLocationValue("street_name") as string | null}
                  onChange={(v) => handleLocationChange("street_name", v)}
                  isEditing={isEditing}
                />
                <EditableField
                  label="Número"
                  value={getLocationValue("street_number") as string | null}
                  onChange={(v) => handleLocationChange("street_number", v)}
                  isEditing={isEditing}
                />
                <EditableField
                  label="Código Postal"
                  value={getLocationValue("postal_code") as string | null}
                  onChange={(v) => handleLocationChange("postal_code", v)}
                  isEditing={isEditing}
                />
                <EditableField
                  label="Ciudad"
                  value={getLocationValue("city_name") as string | null}
                  onChange={(v) => handleLocationChange("city_name", v)}
                  isEditing={isEditing}
                />
                <EditableField
                  label="Código Ciudad"
                  value={getLocationValue("city_code") as string | null}
                  onChange={(v) => handleLocationChange("city_code", v)}
                  isEditing={isEditing}
                />
                <EditableField
                  label="Distrito"
                  value={getLocationValue("district_name") as string | null}
                  onChange={(v) => handleLocationChange("district_name", v)}
                  isEditing={isEditing}
                />
                <EditableField
                  label="Código Distrito"
                  value={getLocationValue("district_code") as string | null}
                  onChange={(v) => handleLocationChange("district_code", v)}
                  isEditing={isEditing}
                />
                <EditableField
                  label="Barrio"
                  value={getLocationValue("neighborhood_name") as string | null}
                  onChange={(v) => handleLocationChange("neighborhood_name", v)}
                  isEditing={isEditing}
                />
                <EditableField
                  label="Código Barrio"
                  value={getLocationValue("neighborhood_code") as string | null}
                  onChange={(v) => handleLocationChange("neighborhood_code", v)}
                  isEditing={isEditing}
                />
                <EditableField
                  label="Planta/Nivel"
                  value={getLocationValue("floor") as string | null}
                  onChange={(v) => handleLocationChange("floor", v)}
                  isEditing={isEditing}
                />
              </div>

              {/* Coordinates */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Coordenadas</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <EditableField
                    label="Latitud"
                    value={getAedValue("latitude") as number | null}
                    onChange={(v) => handleAedChange("latitude", v)}
                    isEditing={isEditing}
                    type="number"
                  />
                  <EditableField
                    label="Longitud"
                    value={getAedValue("longitude") as number | null}
                    onChange={(v) => handleAedChange("longitude", v)}
                    isEditing={isEditing}
                    type="number"
                  />
                  <EditableField
                    label="Precisión"
                    value={getAedValue("coordinates_precision") as string | null}
                    onChange={(v) => handleAedChange("coordinates_precision", v)}
                    isEditing={isEditing}
                    type="select"
                    options={[
                      { value: "", label: "No especificada" },
                      { value: "ADDRESS_MATCH", label: "Dirección exacta" },
                      { value: "STREET_LEVEL", label: "Nivel de calle" },
                      { value: "CITY_LEVEL", label: "Nivel de ciudad" },
                      { value: "USER_PLACED", label: "Colocada por usuario" },
                      { value: "GPS", label: "GPS" },
                    ]}
                  />
                </div>

                {/* Map preview (read-only) */}
                {aed.latitude && aed.longitude && !isEditing && (
                  <div className="mt-3 relative rounded border border-gray-300 overflow-hidden">
                    <iframe
                      width="100%"
                      height="250"
                      frameBorder="0"
                      scrolling="no"
                      marginHeight={0}
                      marginWidth={0}
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${aed.longitude - 0.005},${aed.latitude - 0.005},${aed.longitude + 0.005},${aed.latitude + 0.005}&layer=mapnik&marker=${aed.latitude},${aed.longitude}`}
                      style={{ border: 0 }}
                    />
                    <div className="absolute bottom-2 left-2 right-2 flex gap-2">
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${aed.latitude}&mlon=${aed.longitude}#map=18/${aed.latitude}/${aed.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-3 py-1.5 bg-white/90 hover:bg-white text-sm text-blue-600 rounded shadow text-center"
                      >
                        OpenStreetMap
                      </a>
                      <a
                        href={`https://www.google.com/maps?q=${aed.latitude},${aed.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 px-3 py-1.5 bg-white/90 hover:bg-white text-sm text-blue-600 rounded shadow text-center"
                      >
                        Google Maps
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Location details & access instructions */}
              <div className="mt-6 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-6">
                <EditableField
                  label="Detalles de ubicación"
                  value={getLocationValue("location_details") as string | null}
                  onChange={(v) => handleLocationChange("location_details", v)}
                  isEditing={isEditing}
                  type="textarea"
                  placeholder="Descripción del lugar donde se encuentra el DEA..."
                />
                <EditableField
                  label="Instrucciones de acceso"
                  value={getLocationValue("access_instructions") as string | null}
                  onChange={(v) => handleLocationChange("access_instructions", v)}
                  isEditing={isEditing}
                  type="textarea"
                  placeholder="Cómo llegar al DEA..."
                />
              </div>
            </div>

            {/* Schedule Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Horarios de Disponibilidad</h2>
              </div>
              {!aed.schedule && !isEditing ? (
                <p className="text-gray-500 italic text-sm">No hay información de horarios</p>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <EditableField
                      label="Descripción"
                      value={getScheduleValue("description") as string | null}
                      onChange={(v) => handleScheduleChange("description", v)}
                      isEditing={isEditing}
                      placeholder="Descripción del horario..."
                    />
                    <div className="space-y-3">
                      <EditableField
                        label="Vigilancia 24h"
                        value={getScheduleValue("has_24h_surveillance") as boolean}
                        onChange={(v) => handleScheduleChange("has_24h_surveillance", v)}
                        isEditing={isEditing}
                        type="checkbox"
                      />
                      <EditableField
                        label="Acceso restringido"
                        value={getScheduleValue("has_restricted_access") as boolean}
                        onChange={(v) => handleScheduleChange("has_restricted_access", v)}
                        isEditing={isEditing}
                        type="checkbox"
                      />
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Horario Semanal</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-600">Lunes a Viernes</p>
                        <div className="grid grid-cols-2 gap-2">
                          <EditableField
                            label="Apertura"
                            value={getScheduleValue("weekday_opening") as string | null}
                            onChange={(v) => handleScheduleChange("weekday_opening", v)}
                            isEditing={isEditing}
                            type="time"
                          />
                          <EditableField
                            label="Cierre"
                            value={getScheduleValue("weekday_closing") as string | null}
                            onChange={(v) => handleScheduleChange("weekday_closing", v)}
                            isEditing={isEditing}
                            type="time"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-600">Sábados</p>
                        <div className="grid grid-cols-2 gap-2">
                          <EditableField
                            label="Apertura"
                            value={getScheduleValue("saturday_opening") as string | null}
                            onChange={(v) => handleScheduleChange("saturday_opening", v)}
                            isEditing={isEditing}
                            type="time"
                          />
                          <EditableField
                            label="Cierre"
                            value={getScheduleValue("saturday_closing") as string | null}
                            onChange={(v) => handleScheduleChange("saturday_closing", v)}
                            isEditing={isEditing}
                            type="time"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-600">Domingos</p>
                        <div className="grid grid-cols-2 gap-2">
                          <EditableField
                            label="Apertura"
                            value={getScheduleValue("sunday_opening") as string | null}
                            onChange={(v) => handleScheduleChange("sunday_opening", v)}
                            isEditing={isEditing}
                            type="time"
                          />
                          <EditableField
                            label="Cierre"
                            value={getScheduleValue("sunday_closing") as string | null}
                            onChange={(v) => handleScheduleChange("sunday_closing", v)}
                            isEditing={isEditing}
                            type="time"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Días Especiales</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <EditableField
                        label="Festivos como día laborable"
                        value={getScheduleValue("holidays_as_weekday") as boolean}
                        onChange={(v) => handleScheduleChange("holidays_as_weekday", v)}
                        isEditing={isEditing}
                        type="checkbox"
                      />
                      <EditableField
                        label="Cerrado en festivos"
                        value={getScheduleValue("closed_on_holidays") as boolean}
                        onChange={(v) => handleScheduleChange("closed_on_holidays", v)}
                        isEditing={isEditing}
                        type="checkbox"
                      />
                      <EditableField
                        label="Cerrado en agosto"
                        value={getScheduleValue("closed_in_august") as boolean}
                        onChange={(v) => handleScheduleChange("closed_in_august", v)}
                        isEditing={isEditing}
                        type="checkbox"
                      />
                    </div>
                  </div>

                  <EditableField
                    label="Notas del horario"
                    value={getScheduleValue("notes") as string | null}
                    onChange={(v) => handleScheduleChange("notes", v)}
                    isEditing={isEditing}
                    type="textarea"
                    placeholder="Notas adicionales sobre el horario..."
                  />
                </div>
              )}
            </div>

            {/* Responsible Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Responsable y Titular</h2>
              </div>
              {!aed.responsible && !isEditing ? (
                <p className="text-gray-500 italic text-sm">No hay información del responsable</p>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <EditableField
                      label="Nombre"
                      value={getResponsibleValue("name") as string | null}
                      onChange={(v) => handleResponsibleChange("name", v)}
                      isEditing={isEditing}
                      placeholder="Nombre del responsable"
                    />
                    <EditableField
                      label="Email"
                      value={getResponsibleValue("email") as string | null}
                      onChange={(v) => handleResponsibleChange("email", v)}
                      isEditing={isEditing}
                      placeholder="email@ejemplo.com"
                    />
                    <EditableField
                      label="Teléfono"
                      value={getResponsibleValue("phone") as string | null}
                      onChange={(v) => handleResponsibleChange("phone", v)}
                      isEditing={isEditing}
                    />
                    <EditableField
                      label="Teléfono alternativo"
                      value={getResponsibleValue("alternative_phone") as string | null}
                      onChange={(v) => handleResponsibleChange("alternative_phone", v)}
                      isEditing={isEditing}
                    />
                    <EditableField
                      label="Organización"
                      value={getResponsibleValue("organization") as string | null}
                      onChange={(v) => handleResponsibleChange("organization", v)}
                      isEditing={isEditing}
                    />
                    <EditableField
                      label="Cargo"
                      value={getResponsibleValue("position") as string | null}
                      onChange={(v) => handleResponsibleChange("position", v)}
                      isEditing={isEditing}
                    />
                    <EditableField
                      label="Departamento"
                      value={getResponsibleValue("department") as string | null}
                      onChange={(v) => handleResponsibleChange("department", v)}
                      isEditing={isEditing}
                    />
                    <EditableField
                      label="Titularidad"
                      value={getResponsibleValue("ownership") as string | null}
                      onChange={(v) => handleResponsibleChange("ownership", v)}
                      isEditing={isEditing}
                    />
                    <EditableField
                      label="Titularidad del local"
                      value={getResponsibleValue("local_ownership") as string | null}
                      onChange={(v) => handleResponsibleChange("local_ownership", v)}
                      isEditing={isEditing}
                    />
                    <EditableField
                      label="Uso del local"
                      value={getResponsibleValue("local_use") as string | null}
                      onChange={(v) => handleResponsibleChange("local_use", v)}
                      isEditing={isEditing}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Notes Card */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Notas y Observaciones</h2>
              <div className="space-y-6">
                <EditableField
                  label="Notas públicas"
                  value={getAedValue("public_notes") as string | null}
                  onChange={(v) => handleAedChange("public_notes", v)}
                  isEditing={isEditing}
                  type="textarea"
                  placeholder="Notas visibles públicamente..."
                />
                <EditableField
                  label="Motivo de rechazo"
                  value={getAedValue("rejection_reason") as string | null}
                  onChange={(v) => handleAedChange("rejection_reason", v)}
                  isEditing={isEditing}
                  type="textarea"
                  placeholder="Motivo por el que fue rechazado..."
                />
                {/* Internal notes (read-only for now — complex JSON) */}
                {aed.internal_notes && Array.isArray(aed.internal_notes) && aed.internal_notes.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notas Internas</label>
                    <div className="space-y-2">
                      {aed.internal_notes.map((note: InternalNote, idx: number) => (
                        <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
                          <p className="text-sm whitespace-pre-wrap">{note.text || String(note)}</p>
                          {note.author && <p className="text-xs text-gray-600 mt-1">Por: {note.author}</p>}
                          {note.date && <p className="text-xs text-gray-600">{new Date(note.date).toLocaleString("es-ES")}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Origin and Traceability Card (read-only) */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Origen y Trazabilidad</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Origen de los Datos</label>
                    <p className="text-gray-900">{aed.source_origin.replace(/_/g, " ")}</p>
                    {aed.source_details && <p className="text-sm text-gray-600 mt-1">{aed.source_details}</p>}
                  </div>
                  {aed.external_reference && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Referencia Externa</label>
                      <p className="text-gray-900 font-mono text-sm">{aed.external_reference}</p>
                    </div>
                  )}
                  {aed.data_source && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Fuente de Datos</label>
                      <p className="text-gray-900">{aed.data_source.name}</p>
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Verificación</label>
                    {aed.last_verified_at ? (
                      <div>
                        <p className="text-gray-900">
                          {new Date(aed.last_verified_at).toLocaleDateString("es-ES", { year: "numeric", month: "long", day: "numeric" })}
                        </p>
                        {aed.verification_method && <p className="text-sm text-gray-600">Método: {aed.verification_method}</p>}
                      </div>
                    ) : (
                      <p className="text-gray-600 italic">Sin verificar</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Metadatos</label>
                    <div className="space-y-1 text-sm">
                      <p className="text-gray-600">Creado: {new Date(aed.created_at).toLocaleString("es-ES")}</p>
                      <p className="text-gray-600">Actualizado: {new Date(aed.updated_at).toLocaleString("es-ES")}</p>
                      {aed.sequence && <p className="text-gray-600">Secuencia: #{aed.sequence}</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════ IMAGES TAB ════════════════════ */}
        {activeTab === "images" && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Imágenes ({aed.images.length - imagesToDelete.length + newImages.length})
              </h2>
              {isEditing && (
                <div>
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    <Upload className="w-4 h-4" />
                    Subir imágenes
                  </button>
                </div>
              )}
            </div>

            {/* Existing images */}
            {aed.images.length === 0 && newImages.length === 0 ? (
              <div className="text-center py-12">
                <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No hay imágenes disponibles</p>
                {isEditing && (
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    + Subir primera imagen
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* Existing images */}
                {aed.images.map((image) => {
                  const markedForDeletion = imagesToDelete.includes(image.id);
                  const isProcessing = processingImageId === image.id;
                  return (
                    <div key={image.id} className={`relative group ${markedForDeletion ? "opacity-40" : ""}`}>
                      {/* Loading overlay when processing */}
                      {isProcessing && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 rounded-lg">
                          <div className="text-center">
                            <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto" />
                            <p className="text-xs text-gray-600 mt-1">Procesando...</p>
                          </div>
                        </div>
                      )}
                      <div
                        className="cursor-pointer"
                        onClick={() => !markedForDeletion && !isProcessing && setLightboxUrl(image.processed_url || image.original_url)}
                      >
                        <img
                          src={image.processed_url || image.original_url}
                          alt={image.type}
                          className="w-full h-40 object-cover rounded-lg border-2 border-gray-200"
                        />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent rounded-b-lg p-2">
                        <span className="text-white text-xs font-medium">
                          {imageTypeOptions.find((o) => o.value === image.type)?.label || image.type}
                        </span>
                      </div>
                      {image.is_verified && !markedForDeletion && (
                        <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1" title="Verificada">
                          <CheckCircle className="w-3 h-3 text-white" />
                        </div>
                      )}

                      {/* Hover actions: view */}
                      {!markedForDeletion && !isEditing && !isProcessing && (
                        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                          <button
                            onClick={() => setLightboxUrl(image.processed_url || image.original_url)}
                            className="bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5"
                            title="Ver imagen"
                          >
                            <Eye className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      {/* Edit mode: delete + reprocess */}
                      {isEditing && !isProcessing && (
                        <div className="absolute top-2 left-2 flex gap-1">
                          {markedForDeletion ? (
                            <button
                              onClick={() => setImagesToDelete((prev) => prev.filter((i) => i !== image.id))}
                              className="bg-blue-500 hover:bg-blue-600 text-white rounded-full p-1.5 shadow-lg"
                              title="Deshacer eliminación"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => handleProcessExistingImage(image)}
                                className="bg-purple-500 hover:bg-purple-600 text-white rounded-full p-1.5 shadow-lg"
                                title="Reprocesar (recortar, difuminar, flecha)"
                              >
                                <Scissors className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setImagesToDelete((prev) => [...prev, image.id])}
                                className="bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg"
                                title="Eliminar"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      )}

                      {/* Not editing: show reprocess button on hover */}
                      {!isEditing && !markedForDeletion && !isProcessing && (
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!image.is_verified && (
                            <button
                              onClick={() => handleProcessExistingImage(image)}
                              className="bg-purple-500 hover:bg-purple-600 text-white rounded-full p-1.5 shadow-lg"
                              title="Procesar imagen (recortar, difuminar, flecha)"
                            >
                              <Scissors className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}

                      {markedForDeletion && (
                        <div className="absolute inset-0 flex items-center justify-center bg-red-500/60 rounded-lg">
                          <span className="text-white font-semibold text-sm">Se eliminará</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* New images (pending upload) */}
                {newImages.map((img, idx) => (
                  <div key={`new-${idx}`} className="relative group">
                    <img
                      src={img.processedPreviewUrl || img.url}
                      alt="Nueva imagen"
                      className={`w-full h-40 object-cover rounded-lg border-2 ${
                        img.processingResult ? "border-green-400" : "border-blue-300"
                      }`}
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-blue-900/70 to-transparent rounded-b-lg p-2">
                      <select
                        value={img.type}
                        onChange={(e) => handleNewImageTypeChange(idx, e.target.value)}
                        className="w-full text-xs bg-white/90 rounded px-1 py-0.5"
                      >
                        {imageTypeOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="absolute top-1 right-1 flex gap-1">
                      {img.processingResult ? (
                        <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <CheckCircle className="w-3 h-3" /> Procesada
                        </span>
                      ) : (
                        <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded">
                          Nueva
                        </span>
                      )}
                    </div>
                    <div className="absolute top-1 left-1 flex gap-1">
                      <button
                        onClick={() => handleProcessNewImage(idx)}
                        className="bg-purple-500 hover:bg-purple-600 text-white rounded-full p-1 shadow-lg"
                        title={img.processingResult ? "Reprocesar" : "Procesar (recortar, difuminar, flecha)"}
                      >
                        {img.processingResult ? <RefreshCw className="w-3 h-3" /> : <Scissors className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => handleRemoveNewImage(idx)}
                        className="bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-lg"
                        title="Quitar"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* Add more button */}
                {isEditing && (
                  <button
                    onClick={() => imageInputRef.current?.click()}
                    className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
                  >
                    <Plus className="w-8 h-8 text-gray-400" />
                    <span className="text-sm text-gray-500 mt-1">Añadir imagen</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════ VERIFICATIONS TAB ════════════════════ */}
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
                  {aed.org_verifications.map((verification) => (
                    <div key={verification.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">{verification.organization.name}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(verification.verified_at).toLocaleDateString("es-ES", {
                              year: "numeric", month: "long", day: "numeric",
                            })}
                          </p>
                        </div>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {verification.verification_type}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {verification.verified_photos && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Fotos</span>}
                        {verification.verified_address && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Dirección</span>}
                        {verification.verified_schedule && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Horario</span>}
                        {verification.verified_access && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Acceso</span>}
                        {verification.verified_signage && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Señalización</span>}
                      </div>
                      {verification.notes && <p className="text-sm text-gray-600 mt-2">{verification.notes}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Photo Validations */}
            {aed.validations && (aed.validations as Array<{ id: string; status: string; completed_at: string | null; started_at: string; result: unknown }>).length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Validaciones Fotográficas ({(aed.validations as unknown[]).length})
                </h2>
                <div className="space-y-4">
                  {(aed.validations as Array<{ id: string; status: string; completed_at: string | null; started_at: string; result: { processed_images_count?: number } | null }>).map((validation) => (
                    <div key={validation.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium text-gray-900">Validación de imágenes</p>
                          <p className="text-sm text-gray-600">
                            {validation.completed_at
                              ? new Date(validation.completed_at).toLocaleDateString("es-ES", {
                                  year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                                })
                              : new Date(validation.started_at).toLocaleDateString("es-ES", {
                                  year: "numeric", month: "long", day: "numeric",
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
                          {validation.status === "COMPLETED" ? "Completada" : validation.status === "IN_PROGRESS" ? "En progreso" : validation.status}
                        </span>
                      </div>
                      {validation.result?.processed_images_count != null && (
                        <p className="text-sm text-gray-600">{validation.result.processed_images_count} imagen(es) procesada(s)</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aed.org_verifications.length === 0 && (!aed.validations || (aed.validations as unknown[]).length === 0) && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="text-center py-12">
                  <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">No hay verificaciones registradas</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════ ASSIGNMENTS TAB ════════════════════ */}
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
                {aed.assignments.map((assignment) => (
                  <div key={assignment.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-gray-900">{assignment.organization.name}</p>
                        <p className="text-sm text-gray-600">{assignment.assignment_type}</p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          assignment.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {assignment.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Asignado: {new Date(assignment.assigned_at).toLocaleDateString("es-ES", {
                        year: "numeric", month: "long", day: "numeric",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════ HISTORY TAB ════════════════════ */}
        {activeTab === "history" && (
          <div className="space-y-6">
            {/* Status Changes */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Cambios de Estado ({aed.status_changes.length})
              </h2>
              {aed.status_changes.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No hay cambios de estado</p>
              ) : (
                <div className="space-y-3">
                  {aed.status_changes.slice(0, 20).map((change) => (
                    <div key={change.id} className="flex items-start gap-3 border-l-2 border-gray-200 pl-3">
                      <Activity className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{change.previous_status || "INICIAL"}</span>
                          {" → "}
                          <span className="font-medium">{change.new_status}</span>
                        </p>
                        {change.reason && <p className="text-xs text-gray-500">{change.reason}</p>}
                        <p className="text-xs text-gray-600">
                          {new Date(change.created_at).toLocaleString("es-ES")}
                          {change.modified_by && <span className="ml-2 text-gray-400">por {change.modified_by}</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Field Changes */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Cambios de Campos ({counts.field_changes})
              </h2>
              {aed.field_changes.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No hay cambios registrados</p>
              ) : (
                <div className="space-y-3">
                  {aed.field_changes.slice(0, 30).map((change) => (
                    <div key={change.id} className="flex items-start gap-3 border-l-2 border-blue-200 pl-3">
                      <Edit2 className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{change.field_name}</span>
                        </p>
                        <div className="mt-1 text-xs flex flex-wrap gap-1">
                          <span className="text-red-600 line-through break-all">
                            {change.old_value || "(vacío)"}
                          </span>
                          <span className="text-gray-400">→</span>
                          <span className="text-green-600 break-all">
                            {change.new_value || "(vacío)"}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(change.changed_at).toLocaleString("es-ES")}
                          <span className="ml-2 text-gray-400">
                            por {change.changed_by} · {change.change_source}
                          </span>
                        </p>
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
