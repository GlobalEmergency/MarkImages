"use client";

import {
  Building,
  Clock,
  Heart,
  Mail,
  MapPin,
  Navigation as NavigationIcon,
  Phone,
  X,
} from "lucide-react";
import { useState } from "react";

import type { Aed } from "@/types/aed";

interface AedDetailModalProps {
  aed: Aed | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function AedDetailModal({ aed, isOpen, onClose }: AedDetailModalProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  if (!isOpen || !aed) return null;

  const displayImage =
    aed.images && aed.images.length > 0
      ? aed.images[selectedImageIndex].processed_url || aed.images[selectedImageIndex].original_url
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(circle at center, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.9) 100%)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{
          background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full text-white hover:bg-white/20 transition-all"
          style={{
            background: "rgba(0, 0, 0, 0.5)",
            backdropFilter: "blur(10px)",
          }}
        >
          <X className="w-6 h-6" />
        </button>

        {/* Image Gallery */}
        {displayImage && (
          <div className="relative w-full h-64 sm:h-96 bg-gray-900">
            <img src={displayImage} alt={aed.name} className="w-full h-full object-cover" />

            {/* Image Counter */}
            {aed.images && aed.images.length > 1 && (
              <div
                className="absolute bottom-4 right-4 px-3 py-1.5 rounded-full text-white text-sm font-medium"
                style={{
                  background: "rgba(0, 0, 0, 0.6)",
                  backdropFilter: "blur(10px)",
                }}
              >
                {selectedImageIndex + 1} / {aed.images.length}
              </div>
            )}
          </div>
        )}

        {/* Thumbnail Gallery */}
        {aed.images && aed.images.length > 1 && (
          <div className="flex gap-2 p-4 overflow-x-auto bg-gray-50">
            {aed.images.map((image, index) => (
              <button
                key={image.id}
                onClick={() => setSelectedImageIndex(index)}
                className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all ${
                  index === selectedImageIndex
                    ? "border-blue-500 shadow-lg"
                    : "border-gray-300 hover:border-blue-300"
                }`}
              >
                <img
                  src={image.thumbnail_url || image.processed_url || image.original_url}
                  alt={`${aed.name} - ${image.type}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="p-6 sm:p-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">{aed.name}</h2>
                <p className="text-sm text-gray-500">{aed.code}</p>
              </div>
              <div
                className="p-3 rounded-full"
                style={{
                  background: "linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)",
                }}
              >
                <Heart className="w-6 h-6 text-white" />
              </div>
            </div>

            <span className="inline-block px-4 py-2 bg-blue-100 text-blue-800 text-sm rounded-full font-medium">
              {aed.establishment_type}
            </span>
          </div>

          {/* Details Grid */}
          <div className="grid gap-4 sm:gap-6">
            {/* Location */}
            <div className="flex items-start space-x-3 p-4 rounded-xl bg-gray-50">
              <MapPin className="w-6 h-6 text-blue-500 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">Ubicación</h3>
                <p className="text-gray-700">
                  {aed.location.street_type} {aed.location.street_name} {aed.location.street_number}
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  {aed.location.postal_code} - {aed.location.district.name}
                </p>
                {aed.location.access_description && (
                  <p className="text-sm text-gray-600 mt-2 italic">
                    📍 {aed.location.access_description}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Coordenadas: {aed.latitude.toFixed(6)}, {aed.longitude.toFixed(6)}
                </p>
              </div>
            </div>

            {/* Schedule */}
            {aed.schedule && (
              <div className="flex items-start space-x-3 p-4 rounded-xl bg-purple-50">
                <Clock className="w-6 h-6 text-purple-500 flex-shrink-0 mt-1" />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Horario</h3>
                  <p className="text-gray-700">
                    {aed.schedule.has_24h_surveillance
                      ? "✅ Vigilancia 24 horas"
                      : aed.schedule.weekday_opening && aed.schedule.weekday_closing
                        ? `${aed.schedule.weekday_opening} - ${aed.schedule.weekday_closing}`
                        : "Horario no especificado"}
                  </p>
                </div>
              </div>
            )}

            {/* Responsible */}
            <div className="flex items-start space-x-3 p-4 rounded-xl bg-green-50">
              <Building className="w-6 h-6 text-green-500 flex-shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2">Responsable</h3>
                <p className="text-gray-700 font-medium mb-2">{aed.responsible.name}</p>

                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Mail className="w-4 h-4" />
                    <a href={`mailto:${aed.responsible.email}`} className="hover:text-blue-600">
                      {aed.responsible.email}
                    </a>
                  </div>

                  {aed.responsible.phone && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4" />
                      <a href={`tel:${aed.responsible.phone}`} className="hover:text-blue-600">
                        {aed.responsible.phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${aed.latitude},${aed.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all active:scale-95"
              style={{ minHeight: "48px" }}
            >
              <NavigationIcon className="w-5 h-5" />
              <span>Cómo llegar</span>
            </a>

            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-all active:scale-95"
              style={{ minHeight: "48px" }}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
