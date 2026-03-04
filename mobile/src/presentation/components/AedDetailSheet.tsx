import React from "react";
import { IonText, IonButton, IonIcon, IonSpinner, IonChip, IonLabel } from "@ionic/react";
import { navigate as navigateIcon, time, call, location } from "ionicons/icons";

import { useAedDetail } from "../hooks/useAedDetail";
import { buildNavigationUrl } from "../utils/navigation";

interface AedDetailSheetProps {
  aedId: string;
  name: string;
}

/**
 * Detail card shown inside the sheet modal on MapPage.
 * Does NOT use IonContent — the parent modal provides the single scroll
 * container so all children (this card + the "Ver detalle" button) flow
 * naturally without empty-space gaps.
 */
const AedDetailSheet: React.FC<AedDetailSheetProps> = ({ aedId, name }) => {
  const { aed, loading, error } = useAedDetail(aedId);

  const handleNavigate = () => {
    if (aed) {
      window.open(buildNavigationUrl(aed.latitude, aed.longitude, aed.name), "_system");
    }
  };

  if (loading) {
    return (
      <div className="ion-padding">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <IonSpinner />
          <IonText>Cargando {name}...</IonText>
        </div>
      </div>
    );
  }

  if (error || !aed) {
    return (
      <div className="ion-padding">
        <IonText color="danger">{error || "DEA no encontrado"}</IonText>
      </div>
    );
  }

  return (
    <div className="ion-padding" style={{ paddingBottom: 0 }}>
      <IonText>
        <h2 style={{ marginTop: 0, marginBottom: 4 }}>{aed.name}</h2>
      </IonText>

      <div style={{ display: "flex", flexWrap: "wrap", marginBottom: 8 }}>
        {aed.code && (
          <IonChip color="primary">
            <IonLabel>{aed.code}</IonLabel>
          </IonChip>
        )}
        {aed.establishment_type && (
          <IonChip color="medium">
            <IonLabel>{aed.establishment_type}</IonLabel>
          </IonChip>
        )}
      </div>

      {aed.location && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
          <IonIcon
            icon={location}
            style={{ fontSize: 20, marginTop: 2, color: "var(--ion-color-primary)" }}
          />
          <IonText>
            <p style={{ margin: 0 }}>
              {aed.location.street_type} {aed.location.street_name}
              {aed.location.street_number && `, ${aed.location.street_number}`}
              <br />
              {aed.location.postal_code}
              {aed.location.city_name && ` - ${aed.location.city_name}`}
            </p>
            {aed.location.access_instructions && (
              <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--ion-color-medium)" }}>
                {aed.location.access_instructions}
              </p>
            )}
          </IonText>
        </div>
      )}

      {aed.schedule && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <IonIcon icon={time} style={{ fontSize: 20, color: "var(--ion-color-primary)" }} />
          <IonText>
            {aed.schedule.has_24h_surveillance ? (
              <p style={{ margin: 0 }}>Vigilancia 24h</p>
            ) : (
              <p style={{ margin: 0 }}>
                {aed.schedule.weekday_opening && aed.schedule.weekday_closing
                  ? `${aed.schedule.weekday_opening} - ${aed.schedule.weekday_closing}`
                  : "Horario no especificado"}
              </p>
            )}
          </IonText>
        </div>
      )}

      {aed.responsible?.phone && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <IonIcon icon={call} style={{ fontSize: 20, color: "var(--ion-color-primary)" }} />
          <IonText>
            <p style={{ margin: 0 }}>{aed.responsible.phone}</p>
          </IonText>
        </div>
      )}

      <IonButton expand="block" onClick={handleNavigate} style={{ marginTop: 8 }}>
        <IonIcon icon={navigateIcon} slot="start" />
        Cómo llegar
      </IonButton>
    </div>
  );
};

export default AedDetailSheet;
