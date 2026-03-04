"use client";

import { ClipboardCheck, MapPin, AlertCircle, Image as ImageIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, use } from "react";

interface AedForVerification {
  id: string;
  name: string;
  code?: string;
  provisional_number?: number;
  establishment_type?: string;
  location?: {
    street_type?: string;
    street_name?: string;
    street_number?: string;
    postal_code?: string;
    district_name?: string | null;
    neighborhood_name?: string | null;
    city_name?: string | null;
  };
  images?: Array<{
    id: string;
    original_url: string;
    type: string;
  }>;
  status: string;
}

export default function OrgVerifyPage({ params }: { params: Promise<{ orgId: string }> }) {
  const [aeds, setAeds] = useState<AedForVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const router = useRouter();
  const resolvedParams = use(params);
  const orgId = resolvedParams.orgId;

  useEffect(() => {
    fetchAeds(1);
  }, [orgId]);

  const fetchAeds = async (page: number) => {
    try {
      setLoading(page === 1);
      setLoadingMore(page > 1);

      const url = new URL("/api/verify", window.location.origin);
      url.searchParams.set("page", page.toString());
      url.searchParams.set("limit", "12");
      url.searchParams.set("organization_id", orgId);

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error("Error al cargar DEAs");
      }

      const data = await response.json();

      if (page === 1) {
        setAeds(data.data);
      } else {
        setAeds((prev) => [...prev, ...data.data]);
      }

      setCurrentPage(data.pagination.currentPage);
      setHasNextPage(data.pagination.hasNextPage);
    } catch (error) {
      console.error("Error fetching DEAs for verification:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreAeds = () => {
    if (hasNextPage && !loadingMore) {
      fetchAeds(currentPage + 1);
    }
  };

  const startVerification = (aedId: string) => {
    router.push(`/verify/${aedId}`);
  };

  const getFullAddress = (aed: AedForVerification): string => {
    const loc = aed.location;
    if (!loc) return "Dirección no disponible";

    const parts = [];
    if (loc.street_type) parts.push(loc.street_type);
    if (loc.street_name) parts.push(loc.street_name);
    if (loc.street_number) parts.push(loc.street_number);

    let address = parts.join(" ");

    if (loc.neighborhood_name) address += `, ${loc.neighborhood_name}`;
    if (loc.district_name) address += `, ${loc.district_name}`;
    if (loc.postal_code) address += ` (${loc.postal_code})`;
    if (loc.city_name) address += ` - ${loc.city_name}`;

    return address;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-gray-900">Verificaciones</h1>
        <p className="text-sm text-gray-600">{aeds.length} DEAs pendientes de verificación</p>
      </div>

      {/* Empty State */}
      {aeds.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <ClipboardCheck className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">¡Todo al día!</h3>
          <p className="text-gray-600">No hay DEAs pendientes de verificación en tu organización</p>
        </div>
      ) : (
        <>
          {/* DEA Cards Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {aeds.map((aed) => (
              <button
                key={aed.id}
                onClick={() => startVerification(aed.id)}
                className="bg-white rounded-xl p-4 border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all active:scale-98 text-left"
              >
                {/* Image */}
                {aed.images && aed.images.length > 0 ? (
                  <div className="relative w-full h-48 rounded-lg overflow-hidden mb-3 bg-gray-100">
                    <img
                      src={aed.images[0].original_url}
                      alt={aed.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="relative w-full h-48 rounded-lg overflow-hidden mb-3 bg-gray-100 flex items-center justify-center">
                    <ImageIcon className="w-12 h-12 text-gray-400" />
                  </div>
                )}

                {/* Content */}
                <div className="space-y-2">
                  {/* Title */}
                  <h3 className="font-semibold text-gray-900 line-clamp-1">{aed.name}</h3>

                  {/* Type */}
                  {aed.establishment_type && (
                    <span className="inline-block px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700">
                      {aed.establishment_type}
                    </span>
                  )}

                  {/* Address */}
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-gray-600 line-clamp-2">{getFullAddress(aed)}</p>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2 pt-2">
                    <AlertCircle className="w-4 h-4 text-orange-600" />
                    <span className="text-sm text-orange-600 font-medium">
                      Pendiente de verificar
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Load More Button */}
          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <button
                onClick={loadMoreAeds}
                disabled={loadingMore}
                className="px-6 py-3 bg-white border-2 border-blue-600 text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? "Cargando..." : "Cargar más"}
              </button>
            </div>
          )}
        </>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">¿Cómo funciona la verificación?</p>
            <p className="text-blue-800">
              Selecciona un DEA para iniciar el proceso de verificación. Podrás validar la
              ubicación, actualizar fotos y confirmar que el dispositivo está operativo.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
