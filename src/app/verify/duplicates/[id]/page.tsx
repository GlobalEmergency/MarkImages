"use client";

import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  MapPin,
  XCircle,
  Image as ImageIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

import ConfirmDialog from "@/components/ConfirmDialog";
import { useAuth } from "@/contexts/AuthContext";

interface AedData {
  id: string;
  name: string;
  code: string | null;
  provisional_number: number | null;
  establishment_type: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  location: {
    street_type: string | null;
    street_name: string | null;
    street_number: string | null;
    postal_code: string | null;
    district_name: string | null;
    neighborhood_name: string | null;
    specific_location: string | null;
    floor: string | null;
    access_description: string | null;
  } | null;
  images: Array<{
    id: string;
    original_url: string;
    type: string | null;
  }>;
  responsible: {
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  schedule: {
    description: string | null;
  } | null;
}

interface ComparisonData {
  aed: AedData;
  candidateAed: AedData | null;
  comparison: {
    similarityScore: number | null;
    extractedCandidateName: string | null;
    extractedCandidateAddress: string | null;
  };
}

interface DuplicateComparePageProps {
  params: Promise<{ id: string }>;
}

export default function DuplicateComparePage({ params }: DuplicateComparePageProps) {
  const { user, loading: authLoading } = useAuth();
  const [data, setData] = useState<ComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [showNotDuplicateDialog, setShowNotDuplicateDialog] = useState(false);
  const [showConfirmDuplicateDialog, setShowConfirmDuplicateDialog] = useState(false);
  const router = useRouter();
  const resolvedParams = use(params);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/verify/duplicates");
      return;
    }

    if (user) {
      fetchComparisonData();
    }
  }, [authLoading, user, resolvedParams.id, router]);

  const fetchComparisonData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/verify/duplicates/${resolvedParams.id}`);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("DEA no encontrado");
        }
        throw new Error("Error al cargar comparación");
      }

      const responseData: ComparisonData = await response.json();
      setData(responseData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  const handleNotDuplicate = async (notes?: string) => {
    if (!notes) return;

    try {
      setProcessing(true);
      const response = await fetch(`/api/verify/duplicates/${resolvedParams.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "not_duplicate",
          notes,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al procesar acción");
      }

      router.push("/verify/duplicates");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar");
    } finally {
      setProcessing(false);
      setShowNotDuplicateDialog(false);
    }
  };

  const handleConfirmDuplicate = async (notes?: string) => {
    if (!notes) return;

    try {
      setProcessing(true);
      const response = await fetch(`/api/verify/duplicates/${resolvedParams.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "confirm_duplicate",
          notes,
        }),
      });

      if (!response.ok) {
        throw new Error("Error al procesar acción");
      }

      router.push("/verify/duplicates");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al procesar");
    } finally {
      setProcessing(false);
      setShowConfirmDuplicateDialog(false);
    }
  };

  const getScoreColor = (score: number | null) => {
    if (!score) return "text-gray-600";
    if (score >= 80) return "text-red-600";
    if (score >= 70) return "text-orange-600";
    return "text-yellow-600";
  };

  const formatAddress = (location: AedData["location"]) => {
    if (!location) return "Sin dirección";
    return `${location.street_type || ""} ${location.street_name || ""} ${location.street_number || ""}`.trim();
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Cargando comparación...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push("/verify/duplicates")}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Volver al Listado
          </button>
        </div>
      </div>
    );
  }

  if (!user || !data) {
    return null;
  }

  const { aed, candidateAed, comparison } = data;
  const distance =
    aed.latitude && aed.longitude && candidateAed?.latitude && candidateAed?.longitude
      ? calculateDistance(
          aed.latitude,
          aed.longitude,
          candidateAed.latitude,
          candidateAed.longitude
        )
      : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.push("/verify/duplicates")}
            className="text-blue-600 hover:text-blue-700 font-medium mb-4"
          >
            ← Volver al Listado
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Comparación de Duplicados</h1>
              <p className="text-gray-600">Revisa ambos DEAs para determinar si son duplicados</p>
            </div>
            {comparison.similarityScore && (
              <div className="text-right">
                <p className="text-sm text-gray-600 mb-1">Score de Similitud</p>
                <span className={`text-3xl font-bold ${getScoreColor(comparison.similarityScore)}`}>
                  {comparison.similarityScore}/100
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Warning Alert */}
        {comparison.similarityScore && comparison.similarityScore >= 70 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="font-semibold text-yellow-900 mb-1">Alta Probabilidad de Duplicado</p>
                <p className="text-sm text-yellow-800">
                  El score de similitud es alto ({comparison.similarityScore}/100). Revisa
                  cuidadosamente si realmente son DEAs diferentes o si es un duplicado.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Distance Info */}
        {distance !== null && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              <p className="text-blue-900">
                <span className="font-semibold">Distancia entre DEAs:</span>{" "}
                {distance < 1000 ? `${distance}m` : `${(distance / 1000).toFixed(2)}km`}
              </p>
            </div>
          </div>
        )}

        {/* Comparison Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* DEA Nuevo (Posible Duplicado) */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-yellow-100 px-6 py-4 border-b border-yellow-200">
              <h2 className="text-xl font-bold text-yellow-900">DEA Importado (Nuevo)</h2>
              <p className="text-sm text-yellow-700">Este es el DEA que se acaba de importar</p>
            </div>

            <div className="p-6">
              {/* Images */}
              {aed.images && aed.images.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Imágenes ({aed.images.length})
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {aed.images.slice(0, 4).map((img) => (
                      <div
                        key={img.id}
                        className="aspect-square bg-gray-100 rounded-lg overflow-hidden"
                      >
                        <img
                          src={img.original_url}
                          alt="DEA"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Details */}
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Nombre</p>
                  <p className="text-lg font-semibold text-gray-900">{aed.name}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-500">Código</p>
                  <p className="text-gray-900">
                    {aed.code ||
                      (aed.provisional_number ? `#${aed.provisional_number}` : "Sin código")}
                  </p>
                </div>

                {aed.establishment_type && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Tipo de Establecimiento</p>
                    <p className="text-gray-900">{aed.establishment_type}</p>
                  </div>
                )}

                <div>
                  <p className="text-sm font-medium text-gray-500">Dirección</p>
                  <p className="text-gray-900">{formatAddress(aed.location)}</p>
                  {aed.location?.postal_code && (
                    <p className="text-sm text-gray-600">CP: {aed.location.postal_code}</p>
                  )}
                  {aed.location?.district_name && (
                    <p className="text-sm text-gray-600">Distrito: {aed.location.district_name}</p>
                  )}
                </div>

                {aed.location?.floor && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Planta</p>
                    <p className="text-gray-900">{aed.location.floor}</p>
                  </div>
                )}

                {aed.location?.specific_location && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Ubicación Específica</p>
                    <p className="text-gray-900">{aed.location.specific_location}</p>
                  </div>
                )}

                {aed.location?.access_description && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Descripción de Acceso</p>
                    <p className="text-sm text-gray-700">{aed.location.access_description}</p>
                  </div>
                )}

                {aed.responsible && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Responsable</p>
                    <p className="text-gray-900">{aed.responsible.name}</p>
                    {aed.responsible.phone && (
                      <p className="text-sm text-gray-600">{aed.responsible.phone}</p>
                    )}
                  </div>
                )}

                {aed.latitude && aed.longitude && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Coordenadas</p>
                    <p className="text-sm text-gray-700 font-mono">
                      {aed.latitude.toFixed(5)}, {aed.longitude.toFixed(5)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* DEA Candidato (Existente) */}
          {candidateAed ? (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-green-100 px-6 py-4 border-b border-green-200">
                <h2 className="text-xl font-bold text-green-900">DEA Existente</h2>
                <p className="text-sm text-green-700">Este DEA ya existe en la base de datos</p>
              </div>

              <div className="p-6">
                {/* Images */}
                {candidateAed.images && candidateAed.images.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      Imágenes ({candidateAed.images.length})
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      {candidateAed.images.slice(0, 4).map((img) => (
                        <div
                          key={img.id}
                          className="aspect-square bg-gray-100 rounded-lg overflow-hidden"
                        >
                          <img
                            src={img.original_url}
                            alt="DEA"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Details */}
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Nombre</p>
                    <p className="text-lg font-semibold text-gray-900">{candidateAed.name}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-500">Código</p>
                    <p className="text-gray-900">
                      {candidateAed.code ||
                        (candidateAed.provisional_number
                          ? `#${candidateAed.provisional_number}`
                          : "Sin código")}
                    </p>
                  </div>

                  {candidateAed.establishment_type && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Tipo de Establecimiento</p>
                      <p className="text-gray-900">{candidateAed.establishment_type}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium text-gray-500">Dirección</p>
                    <p className="text-gray-900">{formatAddress(candidateAed.location)}</p>
                    {candidateAed.location?.postal_code && (
                      <p className="text-sm text-gray-600">
                        CP: {candidateAed.location.postal_code}
                      </p>
                    )}
                    {candidateAed.location?.district_name && (
                      <p className="text-sm text-gray-600">
                        Distrito: {candidateAed.location.district_name}
                      </p>
                    )}
                  </div>

                  {candidateAed.location?.floor && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Planta</p>
                      <p className="text-gray-900">{candidateAed.location.floor}</p>
                    </div>
                  )}

                  {candidateAed.location?.specific_location && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Ubicación Específica</p>
                      <p className="text-gray-900">{candidateAed.location.specific_location}</p>
                    </div>
                  )}

                  {candidateAed.location?.access_description && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Descripción de Acceso</p>
                      <p className="text-sm text-gray-700">
                        {candidateAed.location.access_description}
                      </p>
                    </div>
                  )}

                  {candidateAed.responsible && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Responsable</p>
                      <p className="text-gray-900">{candidateAed.responsible.name}</p>
                      {candidateAed.responsible.phone && (
                        <p className="text-sm text-gray-600">{candidateAed.responsible.phone}</p>
                      )}
                    </div>
                  )}

                  {candidateAed.latitude && candidateAed.longitude && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Coordenadas</p>
                      <p className="text-sm text-gray-700 font-mono">
                        {candidateAed.latitude.toFixed(5)}, {candidateAed.longitude.toFixed(5)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="text-center py-12">
                <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  No se encontró el DEA candidato
                </h3>
                <p className="text-gray-600">
                  No se pudo localizar el DEA similar en la base de datos
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">¿Qué deseas hacer?</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => setShowNotDuplicateDialog(true)}
              disabled={processing}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCircle className="w-5 h-5" />
              <div className="text-left">
                <p className="font-semibold">NO es Duplicado</p>
                <p className="text-sm text-green-100">Son DEAs diferentes, importar normalmente</p>
              </div>
            </button>

            <button
              onClick={() => setShowConfirmDuplicateDialog(true)}
              disabled={processing}
              className="flex items-center justify-center gap-3 px-6 py-4 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              <XCircle className="w-5 h-5" />
              <div className="text-left">
                <p className="font-semibold">SÍ es Duplicado</p>
                <p className="text-sm text-red-100">Es el mismo DEA, rechazar importación</p>
              </div>
            </button>
          </div>
        </div>

        {/* Confirmation Dialogs */}
        <ConfirmDialog
          isOpen={showNotDuplicateDialog}
          title="Confirmar: NO es Duplicado"
          message="Al confirmar, el DEA se marcará como NO duplicado y quedará disponible para verificación normal. ¿Por qué consideras que no es un duplicado?"
          confirmText="Confirmar - NO es Duplicado"
          cancelText="Cancelar"
          confirmColor="green"
          requiresInput
          inputLabel="Motivo (opcional) *"
          inputPlaceholder="Ej: Diferentes plantas, ubicaciones específicas distintas, edificios diferentes..."
          onConfirm={handleNotDuplicate}
          onCancel={() => setShowNotDuplicateDialog(false)}
        />

        <ConfirmDialog
          isOpen={showConfirmDuplicateDialog}
          title="Confirmar: SÍ es Duplicado"
          message="Al confirmar, el DEA importado será rechazado y marcado como duplicado. Esta acción no se puede deshacer. ¿Por qué consideras que es un duplicado?"
          confirmText="Confirmar - ES Duplicado"
          cancelText="Cancelar"
          confirmColor="red"
          requiresInput
          inputLabel="Motivo *"
          inputPlaceholder="Ej: Mismo DEA, misma ubicación, datos idénticos..."
          onConfirm={handleConfirmDuplicate}
          onCancel={() => setShowConfirmDuplicateDialog(false)}
        />
      </div>
    </div>
  );
}
