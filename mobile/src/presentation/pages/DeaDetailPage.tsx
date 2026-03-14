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
  lockClosedOutline,
  lockOpenOutline,
  footstepsOutline,
  carOutline,
  accessibilityOutline,
  alertCircleOutline,
  arrowUpOutline,
  arrowDownOutline,
} from "ionicons/icons";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";

import { useAedDetail } from "../hooks/useAedDetail";
import ImageGallery from "../components/ImageGallery";
import ScheduleBadge from "../components/ScheduleBadge";
import { buildNavigationUrl, buildTelUrl } from "../utils/navigation";
import type { AedAccessPoint } from "../../domain/models/Aed";

const ACCESS_TYPE_ICONS: Record<string, string> = {
  PEDESTRIAN: footstepsOutline,
  VEHICLE: carOutline,
  EMERGENCY: alertCircleOutline,
  WHEELCHAIR: accessibilityOutline,
  UNIVERSAL: navigateOutline,
};

const ACCESS_TYPE_LABELS: Record<string, string> = {
  PEDESTRIAN: "Peatonal",
  VEHICLE: "Vehículo",
  EMERGENCY: "Emergencias",
  WHEELCHAIR: "Accesible",
  UNIVERSAL: "Universal",
};

const RESTRICTION_LABELS: Record<string, string> = {
  NONE: "Acceso libre",
  CODE: "Requiere código",
  KEY: "Requiere llave",
  CARD: "Requiere tarjeta",
  INTERCOM: "Portero automático",
  SECURITY_GUARD: "Vigilante",
  LOCKED_HOURS: "Cerrado fuera de horario",
};

function AccessPointCard({ ap }: { ap: AedAccessPoint }) {
  const handleNavigateToAccess = () => {
    window.open(
      buildNavigationUrl(ap.latitude, ap.longitude, ap.label || "Punto de acceso"),
      "_system"
    );
  };

  const isRestricted = ap.restriction_type !== "NONE";

  return (
    <IonCard style={{ margin: "0 0 8px 0" }}>
      <div style={{ padding: 12 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <IonIcon
            icon={ACCESS_TYPE_ICONS[ap.type] || navigateOutline}
            style={{ fontSize: 20, color: "var(--ion-color-primary)" }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 15 }}>
                {ap.label || ACCESS_TYPE_LABELS[ap.type] || "Acceso"}
              </strong>
              {ap.is_primary && (
                <IonBadge color="primary" style={{ fontSize: 10 }}>
                  Principal
                </IonBadge>
              )}
            </div>
          </div>
          <IonIcon
            icon={isRestricted ? lockClosedOutline : lockOpenOutline}
            style={{
              fontSize: 18,
              color: isRestricted ? "var(--ion-color-warning)" : "var(--ion-color-success)",
            }}
          />
        </div>

        {/* Restriction info */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: 8,
            background: isRestricted
              ? "var(--ion-color-warning-tint)"
              : "var(--ion-color-success-tint)",
            marginBottom: 8,
            fontSize: 13,
          }}
        >
          <span style={{ fontWeight: 600 }}>
            {RESTRICTION_LABELS[ap.restriction_type] || ap.restriction_type}
          </span>
          {ap.unlock_code && (
            <span style={{ marginLeft: "auto", fontFamily: "monospace", fontWeight: 700 }}>
              {ap.unlock_code}
            </span>
          )}
        </div>

        {/* Route info */}
        {(ap.estimated_minutes != null || ap.floor_difference != null) && (
          <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 13, color: "#555" }}>
            {ap.estimated_minutes != null && <span>~{ap.estimated_minutes} min</span>}
            {ap.floor_difference != null && ap.floor_difference !== 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 2 }}>
                <IonIcon
                  icon={ap.floor_difference > 0 ? arrowUpOutline : arrowDownOutline}
                  style={{ fontSize: 14 }}
                />
                {Math.abs(ap.floor_difference)} planta
                {Math.abs(ap.floor_difference) !== 1 ? "s" : ""}
                {ap.has_elevator ? " · ascensor" : ""}
              </span>
            )}
            {!ap.available_24h && (
              <span style={{ color: "var(--ion-color-warning)" }}>
                {ap.schedule_notes || "Horario limitado"}
              </span>
            )}
          </div>
        )}

        {/* Indoor steps */}
        {ap.indoor_steps && ap.indoor_steps.length > 0 && (
          <ol
            style={{
              margin: "0 0 8px 0",
              paddingLeft: 20,
              fontSize: 13,
              color: "#333",
              lineHeight: 1.6,
            }}
          >
            {ap.indoor_steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        )}

        {/* Contact & emergency */}
        {(ap.contact_phone || ap.emergency_phone) && (
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            {ap.contact_phone && (
              <IonButton
                size="small"
                fill="outline"
                onClick={() => window.open(buildTelUrl(ap.contact_phone!), "_system")}
              >
                <IonIcon icon={callOutline} slot="start" />
                {ap.contact_name || "Contacto"}
              </IonButton>
            )}
            {ap.emergency_phone && (
              <IonButton
                size="small"
                color="danger"
                onClick={() => window.open(buildTelUrl(ap.emergency_phone!), "_system")}
              >
                <IonIcon icon={callOutline} slot="start" />
                Emergencia
              </IonButton>
            )}
          </div>
        )}

        {ap.can_deliver_to_entrance && (
          <p style={{ fontSize: 12, color: "var(--ion-color-success)", margin: "0 0 8px 0" }}>
            ✓ El personal puede traer el DEA a esta entrada
          </p>
        )}

        {/* Navigate button */}
        <IonButton expand="block" size="small" onClick={handleNavigateToAccess}>
          <IonIcon icon={navigateOutline} slot="start" />
          Ir a este acceso
        </IonButton>
      </div>
    </IonCard>
  );
}

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
    // Use primary access point coordinates if available, otherwise installation coords
    const primary = aed.access_points?.find((ap) => ap.is_primary);
    const lat = primary?.latitude ?? aed.latitude;
    const lng = primary?.longitude ?? aed.longitude;
    const label = primary?.label ? `${aed.name} - ${primary.label}` : aed.name;
    window.open(buildNavigationUrl(lat, lng, label), "_system");
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
        </IonList>

        {/* Access Points */}
        {aed.access_points && aed.access_points.length > 0 && (
          <div style={{ padding: "8px 16px" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 8px 0" }}>
              Puntos de acceso ({aed.access_points.length})
            </h3>
            {aed.access_points.map((ap) => (
              <AccessPointCard key={ap.id} ap={ap} />
            ))}
          </div>
        )}

        <IonList>
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
