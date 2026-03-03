import React from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonList,
  IonItem,
  IonLabel,
  IonThumbnail,
  IonIcon,
  IonSpinner,
  IonNote,
  IonBadge,
} from "@ionic/react";
import { useHistory } from "react-router-dom";
import { locationOutline, heartOutline, navigateOutline } from "ionicons/icons";

import { NearbyAed } from "../../application/dto/AedDTO";
import { useNearbyAeds } from "../hooks/useNearbyAeds";
import { formatDistance } from "../utils/format";
import ScheduleBadge from "../components/ScheduleBadge";

const NearbyPage: React.FC = () => {
  const { aeds, loading, error, refresh, locationDenied } = useNearbyAeds(5, 10);
  const history = useHistory();

  const handleRefresh = async (event: CustomEvent) => {
    await refresh();
    event.detail.complete();
  };

  const handleTap = (aed: NearbyAed) => {
    history.push(`/dea/${aed.id}`);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>DEAs Cercanos</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {loading && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "60vh",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <IonSpinner name="crescent" />
            <IonNote>Buscando DEAs cercanos...</IonNote>
          </div>
        )}

        {locationDenied && !loading && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "60vh",
              flexDirection: "column",
              gap: 12,
              padding: 32,
              textAlign: "center",
            }}
          >
            <IonIcon
              icon={locationOutline}
              style={{ fontSize: 64, color: "var(--ion-color-medium)" }}
            />
            <h2 style={{ margin: 0, fontSize: 18 }}>Ubicación no disponible</h2>
            <IonNote>
              Activa los permisos de ubicación para ver los desfibriladores más cercanos a ti.
            </IonNote>
          </div>
        )}

        {error && !loading && !locationDenied && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "60vh",
              flexDirection: "column",
              gap: 12,
              padding: 32,
              textAlign: "center",
            }}
          >
            <IonNote color="danger">{error}</IonNote>
            <IonNote>Desliza hacia abajo para reintentar</IonNote>
          </div>
        )}

        {!loading && !error && !locationDenied && aeds.length === 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "60vh",
              flexDirection: "column",
              gap: 12,
              padding: 32,
              textAlign: "center",
            }}
          >
            <IonIcon
              icon={heartOutline}
              style={{ fontSize: 64, color: "var(--ion-color-medium)" }}
            />
            <h2 style={{ margin: 0, fontSize: 18 }}>No se encontraron DEAs</h2>
            <IonNote>No hay desfibriladores registrados cerca de tu ubicación.</IonNote>
          </div>
        )}

        {!loading && aeds.length > 0 && (
          <IonList>
            {aeds.map((aed) => (
              <IonItem key={aed.id} button onClick={() => handleTap(aed)} detail>
                <IonThumbnail slot="start">
                  {aed.images && aed.images.length > 0 ? (
                    <img
                      src={
                        aed.images[0].thumbnail_url ||
                        aed.images[0].processed_url ||
                        aed.images[0].original_url
                      }
                      alt={aed.name}
                      style={{ borderRadius: 8, objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        background: "var(--ion-color-light)",
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <IonIcon
                        icon={heartOutline}
                        style={{ fontSize: 24, color: "var(--ion-color-medium)" }}
                      />
                    </div>
                  )}
                </IonThumbnail>
                <IonLabel>
                  <h2 style={{ fontWeight: 600 }}>{aed.name}</h2>
                  <p>
                    {aed.location?.street_name}
                    {aed.location?.street_number ? ` ${aed.location.street_number}` : ""}
                    {aed.location?.city_name ? `, ${aed.location.city_name}` : ""}
                  </p>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                    {aed.establishment_type && (
                      <IonBadge color="light" style={{ fontSize: 11 }}>
                        {aed.establishment_type}
                      </IonBadge>
                    )}
                    <ScheduleBadge schedule={aed.schedule} />
                  </div>
                </IonLabel>
                <div slot="end" style={{ textAlign: "center", minWidth: 60 }}>
                  <IonIcon
                    icon={navigateOutline}
                    style={{ fontSize: 16, color: "var(--ion-color-primary)" }}
                  />
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ion-color-primary)" }}>
                    {formatDistance(aed.distance)}
                  </div>
                </div>
              </IonItem>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
};

export default NearbyPage;
