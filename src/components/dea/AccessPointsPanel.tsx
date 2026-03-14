"use client";

import { useState, useCallback } from "react";
import {
  MapPin,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Phone,
  Clock,
  Navigation,
  ShieldCheck,
  AlertTriangle,
  Lock,
  Unlock,
  Footprints,
  Car,
  Accessibility,
  Siren,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import dynamic from "next/dynamic";

const LocationPickerMap = dynamic(() => import("@/components/LocationPickerMap"), {
  ssr: false,
  loading: () => <div className="h-48 bg-gray-100 rounded-lg animate-pulse" />,
});

// ── Types ───────────────────────────────────────────────────────────

interface AccessPointImage {
  id: string;
  type: string;
  original_url: string;
  thumbnail_url: string | null;
  order: number;
}

interface AccessPoint {
  id: string;
  aed_id: string;
  latitude: number;
  longitude: number;
  type: string;
  label: string | null;
  is_primary: boolean;
  restriction_type: string;
  unlock_code: string | null;
  contact_phone: string | null;
  contact_name: string | null;
  available_24h: boolean;
  schedule_notes: string | null;
  floor_difference: number | null;
  has_elevator: boolean | null;
  estimated_minutes: number | null;
  indoor_steps: string[] | null;
  emergency_phone: string | null;
  can_deliver_to_entrance: boolean;
  verified: boolean;
  created_at: string;
  updated_at: string;
  images?: AccessPointImage[];
}

interface NewAccessPointData {
  latitude: number;
  longitude: number;
  type: string;
  label: string;
  is_primary: boolean;
  restriction_type: string;
  unlock_code: string;
  contact_phone: string;
  contact_name: string;
  available_24h: boolean;
  schedule_notes: string;
  floor_difference: string;
  has_elevator: boolean;
  estimated_minutes: string;
  indoor_steps: string;
  emergency_phone: string;
  can_deliver_to_entrance: boolean;
}

interface AccessPointsPanelProps {
  aedId: string;
  accessPoints: AccessPoint[];
  aedLatitude: number | null;
  aedLongitude: number | null;
  onRefresh: () => void;
}

// ── Constants ───────────────────────────────────────────────────────

const ACCESS_POINT_TYPES = [
  { value: "PEDESTRIAN", label: "Peatonal", icon: Footprints },
  { value: "VEHICLE", label: "Vehículo", icon: Car },
  { value: "EMERGENCY", label: "Emergencias", icon: Siren },
  { value: "WHEELCHAIR", label: "Accesible", icon: Accessibility },
  { value: "UNIVERSAL", label: "Universal", icon: Navigation },
];

const RESTRICTION_TYPES = [
  { value: "NONE", label: "Acceso libre", icon: Unlock, color: "text-green-600" },
  { value: "CODE", label: "Código", icon: Lock, color: "text-amber-600" },
  { value: "KEY", label: "Llave", icon: Lock, color: "text-amber-600" },
  { value: "CARD", label: "Tarjeta", icon: Lock, color: "text-amber-600" },
  { value: "INTERCOM", label: "Portero", icon: Phone, color: "text-amber-600" },
  { value: "SECURITY_GUARD", label: "Vigilante", icon: ShieldCheck, color: "text-amber-600" },
  {
    value: "LOCKED_HOURS",
    label: "Cerrado fuera de horario",
    icon: Clock,
    color: "text-orange-600",
  },
];

const EMPTY_FORM: NewAccessPointData = {
  latitude: 0,
  longitude: 0,
  type: "PEDESTRIAN",
  label: "",
  is_primary: false,
  restriction_type: "NONE",
  unlock_code: "",
  contact_phone: "",
  contact_name: "",
  available_24h: true,
  schedule_notes: "",
  floor_difference: "",
  has_elevator: false,
  estimated_minutes: "",
  indoor_steps: "",
  emergency_phone: "",
  can_deliver_to_entrance: false,
};

// ── Helpers ─────────────────────────────────────────────────────────

function getTypeInfo(type: string) {
  return ACCESS_POINT_TYPES.find((t) => t.value === type) || ACCESS_POINT_TYPES[4];
}

function getRestrictionInfo(type: string) {
  return RESTRICTION_TYPES.find((t) => t.value === type) || RESTRICTION_TYPES[0];
}

// ── Component ───────────────────────────────────────────────────────

export default function AccessPointsPanel({
  aedId,
  accessPoints,
  aedLatitude,
  aedLongitude,
  onRefresh,
}: AccessPointsPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<NewAccessPointData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm";

  // ── API calls ──

  const handleCreate = useCallback(async () => {
    setError(null);
    setSaving(true);
    try {
      const payload = {
        latitude: formData.latitude,
        longitude: formData.longitude,
        type: formData.type,
        label: formData.label || null,
        is_primary: formData.is_primary,
        restriction_type: formData.restriction_type,
        unlock_code: formData.unlock_code || null,
        contact_phone: formData.contact_phone || null,
        contact_name: formData.contact_name || null,
        available_24h: formData.available_24h,
        schedule_notes: formData.schedule_notes || null,
        floor_difference: formData.floor_difference ? parseInt(formData.floor_difference) : null,
        has_elevator: formData.has_elevator,
        estimated_minutes: formData.estimated_minutes ? parseInt(formData.estimated_minutes) : null,
        indoor_steps: formData.indoor_steps
          ? formData.indoor_steps.split("\n").filter((s) => s.trim())
          : null,
        emergency_phone: formData.emergency_phone || null,
        can_deliver_to_entrance: formData.can_deliver_to_entrance,
      };

      const res = await fetch(`/api/admin/deas/${aedId}/access-points`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        setError(data.error || "Error al crear");
        return;
      }

      setShowForm(false);
      setFormData(EMPTY_FORM);
      onRefresh();
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  }, [aedId, formData, onRefresh]);

  const handleDelete = useCallback(
    async (apId: string) => {
      if (!confirm("¿Eliminar este punto de acceso?")) return;
      setDeleting(apId);
      try {
        const res = await fetch(`/api/admin/deas/${aedId}/access-points/${apId}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!data.success) {
          setError(data.error || "Error al eliminar");
          return;
        }
        onRefresh();
      } catch {
        setError("Error de conexión");
      } finally {
        setDeleting(null);
      }
    },
    [aedId, onRefresh]
  );

  const handleVerify = useCallback(
    async (apId: string, verified: boolean) => {
      try {
        const res = await fetch(`/api/admin/deas/${aedId}/access-points/${apId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ verified }),
        });
        const data = await res.json();
        if (data.success) onRefresh();
      } catch {
        /* ignore */
      }
    },
    [aedId, onRefresh]
  );

  // ── Render ──

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Existing Access Points ── */}
      {accessPoints.length === 0 && !showForm && (
        <div className="text-center py-12">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-1">Sin puntos de acceso</p>
          <p className="text-gray-400 text-sm mb-4">
            Añade puntos de acceso para indicar cómo llegar a este DEA
          </p>
          <button
            onClick={() => {
              setFormData({
                ...EMPTY_FORM,
                latitude: aedLatitude || 40.4168,
                longitude: aedLongitude || -3.7038,
              });
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            Añadir punto de acceso
          </button>
        </div>
      )}

      {accessPoints.map((ap) => {
        const typeInfo = getTypeInfo(ap.type);
        const restrictionInfo = getRestrictionInfo(ap.restriction_type);
        const TypeIcon = typeInfo.icon;
        const RestrictionIcon = restrictionInfo.icon;
        const isExpanded = expandedId === ap.id;

        return (
          <div
            key={ap.id}
            className={`bg-white rounded-lg border ${
              ap.is_primary ? "border-blue-300 ring-1 ring-blue-100" : "border-gray-200"
            } overflow-hidden`}
          >
            {/* Header — always visible */}
            <button
              onClick={() => setExpandedId(isExpanded ? null : ap.id)}
              className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 text-left"
            >
              <TypeIcon className="w-5 h-5 text-blue-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900">{ap.label || typeInfo.label}</span>
                  {ap.is_primary && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                      Principal
                    </span>
                  )}
                  <span className={`text-xs flex items-center gap-1 ${restrictionInfo.color}`}>
                    <RestrictionIcon className="w-3 h-3" />
                    {restrictionInfo.label}
                  </span>
                  {ap.verified && (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Verificado
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3">
                  {ap.estimated_minutes != null && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> ~{ap.estimated_minutes} min
                    </span>
                  )}
                  {ap.floor_difference != null && ap.floor_difference !== 0 && (
                    <span>
                      {ap.floor_difference > 0 ? "↑" : "↓"} {Math.abs(ap.floor_difference)} planta
                      {Math.abs(ap.floor_difference) !== 1 ? "s" : ""}
                      {ap.has_elevator ? " (ascensor)" : ""}
                    </span>
                  )}
                  {!ap.available_24h && (
                    <span className="text-amber-600 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Horario limitado
                    </span>
                  )}
                </div>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {/* Expanded details */}
            {isExpanded && (
              <div className="border-t border-gray-100 p-4 space-y-4">
                {/* Map */}
                <div className="h-48 rounded-lg overflow-hidden border border-gray-200">
                  <iframe
                    className="w-full h-full border-0"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${ap.longitude - 0.003},${ap.latitude - 0.003},${ap.longitude + 0.003},${ap.latitude + 0.003}&layer=mapnik&marker=${ap.latitude},${ap.longitude}`}
                    title={`Acceso: ${ap.label || typeInfo.label}`}
                  />
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  {/* Restriction info */}
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Restricción</p>
                    <p className={`font-medium ${restrictionInfo.color}`}>
                      {restrictionInfo.label}
                    </p>
                    {ap.unlock_code && (
                      <p className="text-gray-700 mt-1">
                        Código: <span className="font-mono font-medium">{ap.unlock_code}</span>
                      </p>
                    )}
                  </div>

                  {/* Contact */}
                  {(ap.contact_phone || ap.contact_name) && (
                    <div>
                      <p className="text-gray-500 text-xs mb-1">Contacto para acceso</p>
                      {ap.contact_name && <p className="text-gray-900">{ap.contact_name}</p>}
                      {ap.contact_phone && (
                        <a
                          href={`tel:${ap.contact_phone}`}
                          className="text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" /> {ap.contact_phone}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Availability */}
                  <div>
                    <p className="text-gray-500 text-xs mb-1">Disponibilidad</p>
                    <p className="text-gray-900">
                      {ap.available_24h ? "24 horas" : ap.schedule_notes || "Horario limitado"}
                    </p>
                  </div>

                  {/* Route info */}
                  {(ap.floor_difference != null || ap.estimated_minutes != null) && (
                    <div>
                      <p className="text-gray-500 text-xs mb-1">Ruta hasta el DEA</p>
                      <div className="text-gray-900 space-y-0.5">
                        {ap.estimated_minutes != null && <p>~{ap.estimated_minutes} min andando</p>}
                        {ap.floor_difference != null && ap.floor_difference !== 0 && (
                          <p>
                            {ap.floor_difference > 0 ? "Subir" : "Bajar"}{" "}
                            {Math.abs(ap.floor_difference)} planta
                            {Math.abs(ap.floor_difference) !== 1 ? "s" : ""}
                            {ap.has_elevator ? " — ascensor disponible" : " — solo escaleras"}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Emergency */}
                  {(ap.emergency_phone || ap.can_deliver_to_entrance) && (
                    <div>
                      <p className="text-gray-500 text-xs mb-1">Emergencia</p>
                      {ap.emergency_phone && (
                        <a
                          href={`tel:${ap.emergency_phone}`}
                          className="text-red-600 hover:underline flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" /> {ap.emergency_phone}
                        </a>
                      )}
                      {ap.can_deliver_to_entrance && (
                        <p className="text-green-700 text-xs mt-1">
                          El personal puede traer el DEA a la entrada
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Indoor steps */}
                {ap.indoor_steps && ap.indoor_steps.length > 0 && (
                  <div>
                    <p className="text-gray-500 text-xs mb-2">Pasos para llegar al DEA</p>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-gray-900">
                      {ap.indoor_steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Images */}
                {ap.images && ap.images.length > 0 && (
                  <div>
                    <p className="text-gray-500 text-xs mb-2">Fotos del acceso</p>
                    <div className="flex gap-2 overflow-x-auto">
                      {ap.images.map((img) => (
                        <img
                          key={img.id}
                          src={img.thumbnail_url || img.original_url}
                          alt="Foto acceso"
                          className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => handleVerify(ap.id, !ap.verified)}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium ${
                      ap.verified
                        ? "bg-green-50 text-green-700 hover:bg-green-100"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {ap.verified ? (
                      <CheckCircle className="w-3.5 h-3.5" />
                    ) : (
                      <ShieldCheck className="w-3.5 h-3.5" />
                    )}
                    {ap.verified ? "Verificado" : "Marcar verificado"}
                  </button>
                  <button
                    onClick={() => handleDelete(ap.id)}
                    disabled={deleting === ap.id}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 ml-auto"
                  >
                    {deleting === ap.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Eliminar
                  </button>
                </div>

                <p className="text-xs text-gray-400">
                  Creado: {new Date(ap.created_at).toLocaleString("es-ES")} · Coords:{" "}
                  {ap.latitude.toFixed(6)}, {ap.longitude.toFixed(6)}
                </p>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Add Access Point Form ── */}
      {showForm && (
        <div className="bg-white rounded-lg border border-blue-200 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-600" />
            Nuevo punto de acceso
          </h3>

          {/* Map picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ubicación del acceso (haz clic en el mapa)
            </label>
            <div className="h-56 rounded-lg overflow-hidden border border-gray-200">
              <LocationPickerMap
                latitude={formData.latitude}
                longitude={formData.longitude}
                onLocationChange={(lat, lng) =>
                  setFormData((prev) => ({ ...prev, latitude: lat, longitude: lng }))
                }
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {formData.latitude.toFixed(6)}, {formData.longitude.toFixed(6)}
            </p>
          </div>

          {/* Basic fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de acceso</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData((p) => ({ ...p, type: e.target.value }))}
                className={inputClass}
              >
                {ACCESS_POINT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre / etiqueta
              </label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData((p) => ({ ...p, label: e.target.value }))}
                placeholder="Ej: Recepción planta 12"
                className={inputClass}
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_primary}
                  onChange={(e) => setFormData((p) => ({ ...p, is_primary: e.target.checked }))}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Acceso principal</span>
              </label>
            </div>
          </div>

          {/* Restrictions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Restricción</label>
              <select
                value={formData.restriction_type}
                onChange={(e) => setFormData((p) => ({ ...p, restriction_type: e.target.value }))}
                className={inputClass}
              >
                {RESTRICTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {formData.restriction_type === "CODE" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código de acceso
                </label>
                <input
                  type="text"
                  value={formData.unlock_code}
                  onChange={(e) => setFormData((p) => ({ ...p, unlock_code: e.target.value }))}
                  placeholder="1234"
                  className={inputClass}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contacto</label>
              <input
                type="text"
                value={formData.contact_name}
                onChange={(e) => setFormData((p) => ({ ...p, contact_name: e.target.value }))}
                placeholder="Vigilante, Recepción..."
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono contacto
              </label>
              <input
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => setFormData((p) => ({ ...p, contact_phone: e.target.value }))}
                placeholder="+34 600 000 000"
                className={inputClass}
              />
            </div>
          </div>

          {/* Availability */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.available_24h}
                onChange={(e) => setFormData((p) => ({ ...p, available_24h: e.target.checked }))}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Disponible 24h</span>
            </label>

            {!formData.available_24h && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Horario de acceso
                </label>
                <input
                  type="text"
                  value={formData.schedule_notes}
                  onChange={(e) => setFormData((p) => ({ ...p, schedule_notes: e.target.value }))}
                  placeholder="L-V 8:00-20:00"
                  className={inputClass}
                />
              </div>
            )}
          </div>

          {/* Route */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Diferencia de plantas
              </label>
              <input
                type="number"
                value={formData.floor_difference}
                onChange={(e) => setFormData((p) => ({ ...p, floor_difference: e.target.value }))}
                placeholder="0 (misma planta), 3 (subir 3)"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minutos hasta el DEA
              </label>
              <input
                type="number"
                value={formData.estimated_minutes}
                onChange={(e) => setFormData((p) => ({ ...p, estimated_minutes: e.target.value }))}
                placeholder="Ej: 3"
                min="0"
                className={inputClass}
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer self-end pb-2">
              <input
                type="checkbox"
                checked={formData.has_elevator}
                onChange={(e) => setFormData((p) => ({ ...p, has_elevator: e.target.checked }))}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Hay ascensor</span>
            </label>
          </div>

          {/* Indoor steps */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pasos para llegar al DEA (uno por línea)
            </label>
            <textarea
              value={formData.indoor_steps}
              onChange={(e) => setFormData((p) => ({ ...p, indoor_steps: e.target.value }))}
              placeholder={
                "Entrar por puerta principal\nGirar a la izquierda\nFinal del pasillo, vitrina roja"
              }
              rows={3}
              className={inputClass}
            />
          </div>

          {/* Emergency */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono de emergencia
              </label>
              <input
                type="tel"
                value={formData.emergency_phone}
                onChange={(e) => setFormData((p) => ({ ...p, emergency_phone: e.target.value }))}
                placeholder="Teléfono directo para emergencias"
                className={inputClass}
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer self-end pb-2">
              <input
                type="checkbox"
                checked={formData.can_deliver_to_entrance}
                onChange={(e) =>
                  setFormData((p) => ({ ...p, can_deliver_to_entrance: e.target.checked }))
                }
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                El personal puede traer el DEA a la entrada
              </span>
            </label>
          </div>

          {/* Form actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleCreate}
              disabled={saving || formData.latitude === 0}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? "Guardando..." : "Crear punto de acceso"}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setFormData(EMPTY_FORM);
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Add button (when there are existing points and form is not shown) */}
      {accessPoints.length > 0 && !showForm && (
        <button
          onClick={() => {
            setFormData({
              ...EMPTY_FORM,
              latitude: aedLatitude || 40.4168,
              longitude: aedLongitude || -3.7038,
            });
            setShowForm(true);
          }}
          className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Añadir otro punto de acceso
        </button>
      )}
    </div>
  );
}
