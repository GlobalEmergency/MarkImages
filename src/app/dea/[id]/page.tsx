"use client";

import {
  ArrowLeft,
  MapPin,
  Clock,
  Users,
  Settings,
  AlertCircle,
  Phone,
  Navigation,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { Aed } from "@/types/aed";

export default function DeaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [aed, setAed] = useState<Aed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAed = async () => {
      try {
        const response = await fetch(`/api/aeds/${params.id}`);
        if (!response.ok) throw new Error("Failed to fetch AED");
        const data = await response.json();
        setAed(data.success ? data.data : data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchAed();
    }
  }, [params.id]);

  const handleCallEmergency = () => {
    window.location.href = "tel:112";
  };

  const handleGetDirections = () => {
    if (aed) {
      window.open(
        `https://www.google.com/maps/dir/?api=1&destination=${aed.latitude},${aed.longitude}`,
        "_blank"
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <MapPin className="w-12 h-12 animate-pulse mx-auto text-blue-500 mb-4" />
          <p className="text-white">Cargando...</p>
        </div>
      </div>
    );
  }

  if (error || !aed) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-500 mb-2">Error</h2>
          <p className="text-gray-300">No se pudo cargar la información del DEA.</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  const address = `${aed.location.street_type} ${aed.location.street_name}, ${aed.location.street_number || ""}`;
  const is24h = aed.schedule?.has_24h_surveillance || false;
  const hasImage = aed.images && aed.images.length > 0;
  const heroImage =
    hasImage && aed.images ? aed.images[0]?.processed_url || aed.images[0]?.original_url : null;

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-24">
      {/* Header */}
      <header className="relative">
        {/* Hero Image */}
        <div className="relative h-64 bg-gradient-to-b from-gray-800 to-gray-700">
          {heroImage ? (
            <img src={heroImage} alt={aed.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <MapPin className="w-20 h-20 text-gray-600" />
            </div>
          )}

          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
        </div>

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 bg-gray-900 bg-opacity-80 text-white rounded-full p-2 hover:bg-opacity-100 transition-all"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        {/* Logo */}
        <div className="absolute top-4 right-4">
          <span className="text-white text-lg font-bold">deamap.es</span>
        </div>
      </header>

      {/* Content */}
      <div className="px-4 -mt-8 relative z-10">
        {/* Status Badge */}
        {is24h && (
          <div className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg mb-4">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            <span className="font-medium text-sm">DISPONIBLE 24H</span>
          </div>
        )}

        {/* Title */}
        <h1 className="text-2xl font-bold mb-6">{aed.name}</h1>

        {/* Location Section */}
        <section className="bg-gray-800 rounded-2xl p-5 mb-4">
          <h2 className="text-lg font-semibold mb-4">Ubicación</h2>

          <div className="flex items-start gap-3 mb-4">
            <MapPin className="w-5 h-5 text-teal-500 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-white font-medium">{address}</p>
              <p className="text-gray-400 text-sm">{aed.location.postal_code} Madrid</p>
              <p className="text-gray-500 text-xs mt-1">{aed.location.district_name}</p>
              <p className="text-gray-500 text-xs mt-2">
                📍 {aed.latitude.toFixed(6)}, {aed.longitude.toFixed(6)}
              </p>
            </div>
          </div>

          {/* Quick actions */}
          <button
            onClick={handleGetDirections}
            className="w-full bg-teal-600 text-white py-3 rounded-lg font-medium hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
          >
            <Navigation className="w-5 h-5" />
            Ver en el mapa
          </button>
        </section>

        {/* Details Section */}
        <section className="bg-gray-800 rounded-2xl p-5 mb-4">
          <h2 className="text-lg font-semibold mb-4">Detalles</h2>

          {/* Schedule */}
          <div className="flex items-start gap-3 mb-4 pb-4 border-b border-gray-700">
            <div className="bg-teal-900 bg-opacity-50 p-2 rounded-lg">
              <Clock className="w-5 h-5 text-teal-400" />
            </div>
            <div className="flex-1">
              <p className="text-white font-medium">
                {is24h
                  ? "Lunes a Domingo: 24 horas"
                  : aed.schedule?.weekday_opening && aed.schedule?.weekday_closing
                    ? `${aed.schedule.weekday_opening} - ${aed.schedule.weekday_closing}`
                    : "Horario no especificado"}
              </p>
              <p className="text-gray-400 text-sm">
                {is24h ? "Disponible las 24 horas" : "Horario de servicio"}
              </p>
            </div>
          </div>

          {/* Access */}
          <div className="flex items-start gap-3 mb-4 pb-4 border-b border-gray-700">
            <div className="bg-teal-900 bg-opacity-50 p-2 rounded-lg">
              <Users className="w-5 h-5 text-teal-400" />
            </div>
            <div className="flex-1">
              <p className="text-white font-medium">Acceso Público</p>
              <p className="text-gray-400 text-sm">
                {aed.location.access_description || "No requiere solicitar al personal"}
              </p>
            </div>
          </div>

          {/* Last verification */}
          <div className="flex items-start gap-3">
            <div className="bg-teal-900 bg-opacity-50 p-2 rounded-lg">
              <Settings className="w-5 h-5 text-teal-400" />
            </div>
            <div className="flex-1">
              <p className="text-white font-medium">
                Última revisión:{" "}
                {aed.published_at
                  ? new Date(aed.published_at).toLocaleDateString("es-ES")
                  : "No disponible"}
              </p>
              <p className="text-gray-400 text-sm">Estado verificado por la comunidad</p>
            </div>
          </div>
        </section>

        {/* Contact Info */}
        <section className="bg-gray-800 rounded-2xl p-5 mb-4">
          <h2 className="text-lg font-semibold mb-4">Contacto</h2>

          <div className="space-y-3 text-sm">
            <div>
              <p className="text-gray-400">Responsable</p>
              <p className="text-white font-medium">{aed.responsible.name}</p>
            </div>

            {aed.responsible.phone && (
              <div>
                <p className="text-gray-400">Teléfono</p>
                <a href={`tel:${aed.responsible.phone}`} className="text-blue-400 hover:underline">
                  {aed.responsible.phone}
                </a>
              </div>
            )}

            <div>
              <p className="text-gray-400">Email</p>
              <a href={`mailto:${aed.responsible.email}`} className="text-blue-400 hover:underline">
                {aed.responsible.email}
              </a>
            </div>
          </div>
        </section>

        {/* Report Problem Button */}
        <button className="w-full bg-transparent border border-red-500 text-red-500 py-3 rounded-lg font-medium hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center gap-2 mb-20">
          <AlertCircle className="w-5 h-5" />
          Reportar un problema
        </button>
      </div>

      {/* Bottom Action Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 p-4 z-50">
        <div className="max-w-7xl mx-auto flex gap-3">
          <button
            onClick={handleGetDirections}
            className="flex-1 bg-teal-500 text-white py-4 rounded-xl font-medium hover:bg-teal-600 transition-colors flex items-center justify-center gap-2"
          >
            <Navigation className="w-5 h-5" />
            Cómo llegar
          </button>
          <button
            onClick={handleCallEmergency}
            className="flex-1 bg-red-500 text-white py-4 rounded-xl font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
          >
            <Phone className="w-5 h-5" />
            Llamar al 112
          </button>
        </div>
      </div>
    </div>
  );
}
