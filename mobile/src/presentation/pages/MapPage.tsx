import React, { useCallback, useRef, useState } from "react";
import {
  IonPage,
  IonContent,
  IonFab,
  IonFabButton,
  IonIcon,
  IonModal,
  useIonToast,
} from "@ionic/react";
import { locate } from "ionicons/icons";
import type { Map as LeafletMap } from "leaflet";

import { AedMapMarker } from "../../domain/models/Aed";
import MapView from "../components/map/MapView";
import AedDetailSheet from "../components/AedDetailSheet";
import { useGeolocation } from "../hooks/useGeolocation";

const MapPage: React.FC = () => {
  const [selectedAed, setSelectedAed] = useState<AedMapMarker | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const { getCurrentPosition, loading: geoLoading } = useGeolocation();
  const [presentToast] = useIonToast();

  // We need a ref to the map to fly to user location
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const handleMarkerSelect = useCallback((aed: AedMapMarker) => {
    setSelectedAed(aed);
    setShowDetail(true);
  }, []);

  const handleLocateMe = useCallback(async () => {
    const coords = await getCurrentPosition();
    if (coords) {
      // Access the leaflet map instance through the DOM
      const mapContainer = mapContainerRef.current?.querySelector(".leaflet-container");
      if (mapContainer) {
        const mapInstance = (mapContainer as unknown as { _leaflet_id: number })?._leaflet_id;
        // Use a more reliable approach - dispatch a custom event
        const event = new CustomEvent("fly-to-location", {
          detail: { lat: coords.latitude, lng: coords.longitude },
        });
        mapContainer.dispatchEvent(event);
      }
      presentToast({
        message: "Ubicación actualizada",
        duration: 1500,
        position: "top",
        color: "success",
      });
    } else {
      presentToast({
        message: "No se pudo obtener la ubicación",
        duration: 2000,
        position: "top",
        color: "warning",
      });
    }
  }, [getCurrentPosition, presentToast]);

  return (
    <IonPage>
      <IonContent fullscreen>
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }}>
          <MapView onMarkerSelect={handleMarkerSelect} />
        </div>

        <IonFab vertical="bottom" horizontal="end" slot="fixed" style={{ marginBottom: 60 }}>
          <IonFabButton size="small" onClick={handleLocateMe} disabled={geoLoading}>
            <IonIcon icon={locate} />
          </IonFabButton>
        </IonFab>

        <IonModal
          isOpen={showDetail}
          onDidDismiss={() => setShowDetail(false)}
          initialBreakpoint={0.4}
          breakpoints={[0, 0.4, 0.8]}
          handleBehavior="cycle"
        >
          {selectedAed && (
            <AedDetailSheet aedId={selectedAed.id} name={selectedAed.name} />
          )}
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default MapPage;
