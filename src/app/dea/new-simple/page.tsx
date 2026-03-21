"use client";

import {
  MapPin,
  Navigation,
  Camera,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Clock,
  Info,
  ExternalLink,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";

import { useAnalytics } from "@/hooks/useAnalytics";
import { useDeaImages } from "@/hooks/useDeaImages";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { AddressData } from "@/hooks/useGeolocation";
import { buildAedPayload } from "@/lib/build-aed-payload";

// Dynamic import to avoid SSR issues with Leaflet
const LocationPickerMap = dynamic(() => import("@/components/LocationPickerMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[300px] flex items-center justify-center bg-gray-50 rounded-xl">
      <div className="text-center">
        <MapPin className="w-8 h-8 animate-pulse mx-auto text-emerald-600 mb-2" />
        <p className="text-gray-500 text-sm">Cargando mapa...</p>
      </div>
    </div>
  ),
});

type Step = 1 | 2;

export default function NewSimpleDeaPage() {
  const router = useRouter();
  const { trackFormStart, trackFormFieldFocus, trackFormSubmit, trackButtonClick, trackModalOpen } =
    useAnalytics();

  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [formStarted, setFormStarted] = useState(false);
  const [showExtraDetails, setShowExtraDetails] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    latitude: "",
    longitude: "",
    street: "",
    number: "",
    city: "",
    postalCode: "",
    country: "España",
    name: "",
    establishmentType: "",
    observations: "",
    accessDescription: "",
    floor: "",
    specificLocation: "",
    scheduleDescription: "",
  });

  // ── Hooks ─────────────────────────────────────────────────────

  const handlePositionObtained = useCallback((lat: number, lng: number) => {
    setFormData((prev) => ({
      ...prev,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    }));
  }, []);

  const handleAddressObtained = useCallback((address: AddressData) => {
    setFormData((prev) => ({
      ...prev,
      street: address.street || prev.street,
      number: address.number || prev.number,
      city: address.city || prev.city,
      postalCode: address.postalCode || prev.postalCode,
      country: address.country || prev.country,
    }));
  }, []);

  const {
    geolocating,
    reverseGeocoding,
    error: geoError,
    requestPosition,
    reverseGeocode,
  } = useGeolocation(handlePositionObtained, handleAddressObtained);

  const {
    images,
    fileInputRef,
    canAddMore,
    openFilePicker,
    handleFileSelect,
    removeImage,
    uploadAll,
  } = useDeaImages();

  // Propagate geolocation errors to main error state
  useEffect(() => {
    if (geoError) setError(geoError);
  }, [geoError]);

  // Track form start on first interaction
  useEffect(() => {
    if (!formStarted && (formData.name || formData.street || formData.latitude)) {
      trackFormStart("add_dea_simple_v2");
      setFormStarted(true);
    }
  }, [formData, formStarted, trackFormStart]);

  // ── Handlers ──────────────────────────────────────────────────

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFieldFocus = (fieldName: string) => {
    trackFormFieldFocus("add_dea_simple_v2", fieldName);
  };

  const handleGeolocate = () => {
    setError(null);
    trackButtonClick("geolocate", "step_1_location");
    requestPosition();
  };

  const handleLocationChange = async (lat: number, lng: number) => {
    handlePositionObtained(lat, lng);
    await reverseGeocode(lat, lng);
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      // Upload images (presigned URLs — works for anonymous and authenticated users)
      let uploadedImages: { original_url: string; type: string; order: number }[] = [];

      if (images.length > 0) {
        const { uploaded, failedCount } = await uploadAll();
        uploadedImages = uploaded;
        if (failedCount > 0) {
          setError(
            `No se pudieron subir ${failedCount} de ${images.length} foto(s). El DEA se enviará con las fotos que se subieron correctamente.`
          );
        }
      }

      const payload = buildAedPayload(formData, uploadedImages);

      const response = await fetch("/api/aeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Error al crear el DEA");
      }

      trackFormSubmit("add_dea_simple_v2", true);
      trackModalOpen("dea_success");
      setShowSuccess(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      trackFormSubmit("add_dea_simple_v2", false, errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessClose = () => {
    trackButtonClick("back_to_map", "dea_success_modal");
    setShowSuccess(false);
    router.push("/");
  };

  // ── Derived state ─────────────────────────────────────────────

  const hasCoords = !!(formData.latitude && formData.longitude);
  const hasAddress = !!(formData.street && formData.city);
  const canProceedToStep2 = hasCoords || hasAddress;
  const canSubmit = formData.name.trim().length >= 2;

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => {
              if (step === 2) setStep(1);
              else router.push("/");
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-gray-900">Agregar DEA</h1>
            <p className="text-xs text-gray-500">
              Paso {step} de 2 &mdash; {step === 1 ? "Ubicación" : "Detalles"}
            </p>
          </div>
          <div className="flex gap-1.5">
            <div
              className={`h-1.5 w-8 rounded-full transition-colors ${step >= 1 ? "bg-emerald-500" : "bg-gray-200"}`}
            />
            <div
              className={`h-1.5 w-8 rounded-full transition-colors ${step >= 2 ? "bg-emerald-500" : "bg-gray-200"}`}
            />
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-2">
            <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── STEP 1: Location ─────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="text-center mb-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 mb-3">
                <MapPin className="w-6 h-6 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">¿Dónde está el DEA?</h2>
              <p className="text-sm text-gray-500 mt-1">
                Usa tu ubicación actual o marca el punto en el mapa
              </p>
            </div>

            <button
              type="button"
              onClick={handleGeolocate}
              disabled={geolocating}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl font-medium transition-colors shadow-sm"
            >
              {geolocating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Obteniendo ubicación...
                </>
              ) : (
                <>
                  <Navigation className="w-5 h-5" />
                  Usar mi ubicación actual
                </>
              )}
            </button>

            {reverseGeocoding && (
              <p className="text-center text-xs text-gray-400">Obteniendo dirección...</p>
            )}

            <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
              <LocationPickerMap
                latitude={formData.latitude ? parseFloat(formData.latitude) : 0}
                longitude={formData.longitude ? parseFloat(formData.longitude) : 0}
                onLocationChange={handleLocationChange}
              />
            </div>

            {hasCoords && (
              <p className="text-center text-xs text-gray-400">
                Coordenadas: {formData.latitude}, {formData.longitude}
              </p>
            )}

            {/* Address fields */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Dirección
                {reverseGeocoding && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
              </h3>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Calle</label>
                  <input
                    type="text"
                    name="street"
                    value={formData.street}
                    onChange={handleChange}
                    onFocus={() => handleFieldFocus("street")}
                    placeholder="Ej: Calle Mayor"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nº</label>
                  <input
                    type="text"
                    name="number"
                    value={formData.number}
                    onChange={handleChange}
                    onFocus={() => handleFieldFocus("number")}
                    placeholder="23"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Población</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    onFocus={() => handleFieldFocus("city")}
                    placeholder="Madrid"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">C.P.</label>
                  <input
                    type="text"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleChange}
                    onFocus={() => handleFieldFocus("postalCode")}
                    placeholder="28001"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                trackButtonClick("next_step", "step_1_location");
                setStep(2);
              }}
              disabled={!canProceedToStep2}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
            >
              Continuar
              <ArrowRight className="w-4 h-4" />
            </button>

            {!canProceedToStep2 && (
              <p className="text-center text-xs text-gray-400">
                Marca un punto en el mapa o escribe al menos la calle y población
              </p>
            )}
          </div>
        )}

        {/* ── STEP 2: Details ──────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="text-center mb-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-3">
                <Info className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Cuéntanos sobre el DEA</h2>
              <p className="text-sm text-gray-500 mt-1">
                Cuantos más datos aportes, más fácil será verificarlo
              </p>
            </div>

            {/* Name & type */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre o descripción del lugar *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  onFocus={() => handleFieldFocus("name")}
                  required
                  placeholder="Ej: Farmacia López, Centro deportivo municipal..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Nombre del lugar donde está instalado el DEA
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de lugar
                </label>
                <select
                  name="establishmentType"
                  value={formData.establishmentType}
                  onChange={handleChange}
                  onFocus={() => handleFieldFocus("establishmentType")}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow bg-white"
                >
                  <option value="">Selecciona (opcional)</option>
                  <option value="Farmacia">Farmacia</option>
                  <option value="Centro de salud">Centro de salud</option>
                  <option value="Centro deportivo">Centro deportivo</option>
                  <option value="Centro educativo">Centro educativo</option>
                  <option value="Edificio público">Edificio público</option>
                  <option value="Centro comercial">Centro comercial</option>
                  <option value="Estación de transporte">Estación de transporte</option>
                  <option value="Hotel / alojamiento">Hotel / alojamiento</option>
                  <option value="Empresa privada">Empresa privada</option>
                  <option value="Vía pública">Vía pública</option>
                  <option value="Otro">Otro</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Observaciones
                </label>
                <textarea
                  name="observations"
                  value={formData.observations}
                  onChange={handleChange}
                  onFocus={() => handleFieldFocus("observations")}
                  rows={3}
                  placeholder="Cualquier información útil: dónde se ve, si tiene cartel, si está accesible..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow resize-none"
                />
              </div>
            </div>

            {/* Photos */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  Fotos del DEA
                </h3>
                <span className="text-xs text-gray-400">{images.length}/5</span>
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 space-y-2">
                <p className="font-semibold">
                  Las fotos ayudan a quien necesite encontrar el DEA en una emergencia:
                </p>
                <ul className="list-disc list-inside space-y-1 text-emerald-700">
                  <li>
                    <strong>Entrada al edificio</strong> — fachada o acceso desde la calle
                  </li>
                  <li>
                    <strong>Interior con el DEA visible</strong> — dónde está exactamente dentro
                  </li>
                  <li>Señalización, carteles o indicaciones si las hay</li>
                </ul>
                <a
                  href="/dea/example-verified"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-medium underline underline-offset-2"
                  onClick={() => trackButtonClick("view_example_dea", "photos_section")}
                >
                  <ExternalLink className="w-3 h-3" />
                  Ver un ejemplo de DEA bien documentado
                </a>
              </div>

              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {images.map((img, i) => (
                    <div
                      key={i}
                      className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group"
                    >
                      <img
                        src={img.preview}
                        alt={`Foto ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {img.uploading && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        </div>
                      )}
                      {img.error && (
                        <div className="absolute inset-0 bg-red-500/40 flex items-center justify-center">
                          <span className="text-white text-xs">Error</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeImage(i)}
                        className="absolute top-1 right-1 p-0.5 bg-black/60 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      {i === 0 && (
                        <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                          Principal
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {canAddMore && (
                <button
                  type="button"
                  onClick={openFilePicker}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
                >
                  <Camera className="w-4 h-4" />
                  {images.length === 0 ? "Añadir foto del DEA" : "Añadir otra foto"}
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* Extra details (collapsible) */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowExtraDetails(!showExtraDetails)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  {showExtraDetails ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                  Detalles adicionales (opcional)
                </span>
                <span className="text-xs text-emerald-600 font-normal">
                  Ayuda a la verificación
                </span>
              </button>

              {showExtraDetails && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      ¿Cómo se accede al DEA?
                    </label>
                    <textarea
                      name="accessDescription"
                      value={formData.accessDescription}
                      onChange={handleChange}
                      onFocus={() => handleFieldFocus("accessDescription")}
                      rows={2}
                      placeholder="Ej: Entrando por la puerta principal, a la izquierda en recepción"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Planta / Piso</label>
                      <input
                        type="text"
                        name="floor"
                        value={formData.floor}
                        onChange={handleChange}
                        onFocus={() => handleFieldFocus("floor")}
                        placeholder="Ej: Planta baja"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Ubicación concreta</label>
                      <input
                        type="text"
                        name="specificLocation"
                        value={formData.specificLocation}
                        onChange={handleChange}
                        onFocus={() => handleFieldFocus("specificLocation")}
                        placeholder="Ej: Hall de entrada"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Horario de acceso
                    </label>
                    <input
                      type="text"
                      name="scheduleDescription"
                      value={formData.scheduleDescription}
                      onChange={handleChange}
                      onFocus={() => handleFieldFocus("scheduleDescription")}
                      placeholder="Ej: 24h, Lunes a viernes 9-21h, Solo horario comercial..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-shadow"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Info box */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                Un administrador revisará y completará los datos. Cuanta más información aportes,
                más rápido se publicará el DEA en el mapa.
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Atrás
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit || loading}
                className="flex-[2] flex items-center justify-center gap-2 px-4 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors shadow-sm"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Enviar DEA"
                )}
              </button>
            </div>

            {!canSubmit && (
              <p className="text-center text-xs text-gray-400">
                Escribe al menos el nombre del lugar
              </p>
            )}
          </div>
        )}
      </div>

      {/* ── Success Modal ────────────────────────────────────── */}
      {showSuccess && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-modal-backdrop p-4"
          onClick={handleSuccessClose}
        >
          <div
            className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center animate-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-20 h-20 rounded-full bg-emerald-500 mx-auto mb-6 flex items-center justify-center">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-3">¡Gracias por tu aporte!</h2>

            <p className="text-gray-500 mb-6 leading-relaxed">
              El DEA ha sido registrado y está pendiente de verificación.{" "}
              {images.length > 0 && "Las fotos que subiste ayudarán mucho a agilizar el proceso. "}
              Un administrador lo revisará pronto.
            </p>

            <button
              onClick={handleSuccessClose}
              className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition-colors"
            >
              Volver al mapa
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
