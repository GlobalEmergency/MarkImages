'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import type { Aed } from '@/types/aed';
import { MapPin, Heart, Clock, Phone } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

interface MapViewProps {
  aeds: Aed[];
  onAedClick: (aed: Aed) => void;
}

// Fix for default marker icon in Leaflet with Next.js
const createCustomIcon = () => {
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        background: linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%);
        width: 32px;
        height: 32px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          style="transform: rotate(45deg);"
        >
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
        </svg>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

export default function MapView({ aeds, onAedClick }: MapViewProps) {
  useEffect(() => {
    // Ensure Leaflet styles are loaded
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
    link.crossOrigin = '';
    document.head.appendChild(link);

    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Calculate center of Madrid from all AEDs
  const center: [number, number] = aeds.length > 0
    ? [
        aeds.reduce((sum, aed) => sum + aed.latitude, 0) / aeds.length,
        aeds.reduce((sum, aed) => sum + aed.longitude, 0) / aeds.length,
      ]
    : [40.4168, -3.7038]; // Default Madrid center

  return (
    <div className="w-full h-[600px] rounded-xl overflow-hidden shadow-xl">
      <MapContainer
        center={center}
        zoom={12}
        scrollWheelZoom={true}
        className="w-full h-full"
        style={{ zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {aeds.map((aed) => (
          <Marker
            key={aed.id}
            position={[aed.latitude, aed.longitude]}
            icon={createCustomIcon()}
            eventHandlers={{
              click: () => onAedClick(aed),
            }}
          >
            <Popup>
              <div className="min-w-[200px]">
                <h3 className="font-bold text-gray-900 mb-2">{aed.name}</h3>
                <p className="text-sm text-gray-600 mb-2">{aed.code}</p>

                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-gray-700">
                        {aed.location.street_type} {aed.location.street_name}{' '}
                        {aed.location.street_number}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {aed.location.postal_code} - {aed.location.district.name}
                      </p>
                    </div>
                  </div>

                  {aed.schedule && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-500 flex-shrink-0" />
                      <p className="text-gray-700">
                        {aed.schedule.has_24h_surveillance
                          ? '24h Vigilancia'
                          : aed.schedule.weekday_opening && aed.schedule.weekday_closing
                          ? `${aed.schedule.weekday_opening} - ${aed.schedule.weekday_closing}`
                          : 'Horario no especificado'}
                      </p>
                    </div>
                  )}

                  {aed.responsible.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <p className="text-gray-700">{aed.responsible.phone}</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => onAedClick(aed)}
                  className="w-full mt-3 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg text-sm font-medium hover:shadow-lg transition-all"
                >
                  Ver detalles
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
