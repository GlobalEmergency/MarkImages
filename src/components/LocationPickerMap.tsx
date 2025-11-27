"use client";

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

// Fix for default marker icon
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

interface LocationPickerMapProps {
  latitude: number;
  longitude: number;
  onLocationChange: (lat: number, lng: number) => void;
}

export default function LocationPickerMap({
  latitude,
  longitude,
  onLocationChange,
}: LocationPickerMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Initialize map centered on Madrid
    const map = L.map(containerRef.current).setView(
      [latitude || 40.4168, longitude || -3.7038],
      latitude ? 15 : 11
    );

    // Add OpenStreetMap tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Add marker if coordinates are provided
    if (latitude && longitude) {
      const marker = L.marker([latitude, longitude], {
        draggable: true,
      }).addTo(map);

      marker.on("dragend", () => {
        const position = marker.getLatLng();
        onLocationChange(position.lat, position.lng);
      });

      markerRef.current = marker;
    }

    // Add click event to place/move marker
    map.on("click", (e) => {
      const { lat, lng } = e.latlng;

      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const marker = L.marker([lat, lng], {
          draggable: true,
        }).addTo(map);

        marker.on("dragend", () => {
          const position = marker.getLatLng();
          onLocationChange(position.lat, position.lng);
        });

        markerRef.current = marker;
      }

      onLocationChange(lat, lng);
    });

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker when coordinates change externally
  useEffect(() => {
    if (mapRef.current && latitude && longitude) {
      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
      } else {
        const marker = L.marker([latitude, longitude], {
          draggable: true,
        }).addTo(mapRef.current);

        marker.on("dragend", () => {
          const position = marker.getLatLng();
          onLocationChange(position.lat, position.lng);
        });

        markerRef.current = marker;
      }

      mapRef.current.setView([latitude, longitude], 15);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latitude, longitude]);

  return (
    <div>
      <div
        ref={containerRef}
        style={{
          height: "400px",
          width: "100%",
          borderRadius: "8px",
          border: "1px solid #ccc",
        }}
      />
      <p style={{ marginTop: "8px", fontSize: "14px", color: "#666" }}>
        Haz clic en el mapa para seleccionar la ubicación o arrastra el marcador
      </p>
    </div>
  );
}
