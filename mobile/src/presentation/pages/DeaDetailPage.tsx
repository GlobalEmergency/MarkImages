import React from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonContent,
  IonSpinner,
  IonNote,
  IonButton,
  IonIcon,
  IonCard,
  IonBadge,
  IonList,
  IonItem,
  IonLabel,
} from "@ionic/react";
import { useParams } from "react-router-dom";
import {
  navigateOutline,
  callOutline,
  timeOutline,
  locationOutline,
  businessOutline,
  personOutline,
} from "ionicons/icons";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";

import { useAedDetail } from "../hooks/useAedDetail";
import ImageGallery from "../components/ImageGallery";
import ScheduleBadge from "../components/ScheduleBadge";
import { buildNavigationUrl, buildTelUrl } from "../utils/navigation";

/** Forces Leaflet to recalculate container size after the card finishes layout */
const InvalidateSize: React.FC = () => {
  const map = useMap();
  React.useEffect(() => {
    // Small delay to let Ionic card finish its layout/animation
    const timer = setTimeout(() => map.invalidateSize(), 300);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
};

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="
    width: 24px; height: 24px; background: #16a34a; border: 3px solid white;
    border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

const DeaDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { aed, loading, error } = useAedDetail(id);

  const handleNavigate = () => {
    if (!aed) return;
    window.open(buildNavigationUrl(aed.latitude, aed.longitude, aed.name), "_system");
  };

  const handleCall = () => {
    if (!aed?.responsible?.phone) return;
    window.open(buildTelUrl(aed.responsible.phone), "_system");
  };

  if (loading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/tabs/map" />
            </IonButtons>
            <IonTitle>Cargando...</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 100 }}>
            <IonSpinner name="crescent" />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (error || !aed) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/tabs/map" />
            </IonButtons>
            <IonTitle>Error</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div style={{ padding: 32, textAlign: "center" }}>
            <IonNote color="danger">{error || "DEA no encontrado"}</IonNote>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const address = [
    aed.location?.street_type,
    aed.location?.street_name,
    aed.location?.street_number,
  ]
    .filter(Boolean)
    .join(" ");
  const cityLine = [aed.location?.postal_code, aed.location?.city_name].filter(Boolean).join(" ");

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/map" />
          </IonButtons>
          <IonTitle>{aed.name}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <ImageGallery images={aed.images || []} />

        {/* Name + badges */}
        <div style={{ padding: "16px 16px 8px" }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{aed.name}</h1>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
            <IonBadge color="light">{aed.code}</IonBadge>
            {aed.establishment_type && (
              <IonBadge color="tertiary">{aed.establishment_type}</IonBadge>
            )}
            <ScheduleBadge schedule={aed.schedule} />
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, padding: "8px 16px" }}>
          <IonButton expand="block" onClick={handleNavigate} style={{ flex: 1 }}>
            <IonIcon icon={navigateOutline} slot="start" />
            Cómo llegar
          </IonButton>
          {aed.responsible?.phone && (
            <IonButton expand="block" color="success" onClick={handleCall} style={{ flex: 1 }}>
              <IonIcon icon={callOutline} slot="start" />
              Llamar
            </IonButton>
          )}
        </div>

        {/* Mini map */}
        {aed.latitude && aed.longitude && (
          <IonCard style={{ margin: "8px 16px" }}>
            <div style={{ height: 180 }}>
              <MapContainer
                center={[aed.latitude, aed.longitude]}
                zoom={16}
                style={{ width: "100%", height: "100%" }}
                zoomControl={false}
                dragging={false}
                scrollWheelZoom={false}
                doubleClickZoom={false}
                touchZoom={false}
                attributionControl={false}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[aed.latitude, aed.longitude]} icon={pinIcon} />
                <InvalidateSize />
              </MapContainer>
            </div>
          </IonCard>
        )}

        {/* Address */}
        <IonList>
          <IonItem>
            <IonIcon icon={locationOutline} slot="start" color="primary" />
            <IonLabel>
              <h3>Dirección</h3>
              <p>{address}</p>
              {cityLine && <p>{cityLine}</p>}
              {aed.location?.district_name && (
                <p style={{ fontSize: 13, color: "var(--ion-color-medium)" }}>
                  {aed.location.district_name}
                  {aed.location.neighborhood_name ? ` · ${aed.location.neighborhood_name}` : ""}
                </p>
              )}
            </IonLabel>
          </IonItem>

          {aed.location?.access_instructions && (
            <IonItem>
              <IonIcon icon={businessOutline} slot="start" color="primary" />
              <IonLabel className="ion-text-wrap">
                <h3>Acceso</h3>
                <p>{aed.location.access_instructions}</p>
              </IonLabel>
            </IonItem>
          )}

          {/* Schedule */}
          {aed.schedule && (
            <IonItem>
              <IonIcon icon={timeOutline} slot="start" color="primary" />
              <IonLabel>
                <h3>Horario</h3>
                {aed.schedule.has_24h_surveillance ? (
                  <p>Disponible 24 horas</p>
                ) : (
                  <p>
                    {aed.schedule.weekday_opening && aed.schedule.weekday_closing
                      ? `Lun-Vie: ${aed.schedule.weekday_opening} - ${aed.schedule.weekday_closing}`
                      : "Horario no disponible"}
                  </p>
                )}
              </IonLabel>
            </IonItem>
          )}

          {/* Responsible */}
          {aed.responsible && (
            <IonItem>
              <IonIcon icon={personOutline} slot="start" color="primary" />
              <IonLabel>
                <h3>Responsable</h3>
                <p>{aed.responsible.name}</p>
                {aed.responsible.email && <p style={{ fontSize: 13 }}>{aed.responsible.email}</p>}
              </IonLabel>
            </IonItem>
          )}
        </IonList>

        <div style={{ height: 32 }} />
      </IonContent>
    </IonPage>
  );
};

export default DeaDetailPage;
