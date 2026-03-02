import React, { useEffect, useState } from "react";
import {
  IonContent,
  IonText,
  IonButton,
  IonIcon,
  IonSpinner,
  IonChip,
  IonLabel,
} from "@ionic/react";
import { navigate as navigateIcon, time, call, location } from "ionicons/icons";

import { Aed } from "../../domain/models/Aed";
import { getAedDetailUseCase } from "../../infrastructure/di/container";

interface AedDetailSheetProps {
  aedId: string;
  name: string;
}

const AedDetailSheet: React.FC<AedDetailSheetProps> = ({ aedId, name }) => {
  const [aed, setAed] = useState<Aed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getAedDetailUseCase
      .execute(aedId)
      .then((data) => {
        if (!cancelled) setAed(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error cargando detalle");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [aedId]);

  const handleNavigate = () => {
    if (aed) {
      // Opens native maps app
      const url = `geo:${aed.latitude},${aed.longitude}?q=${aed.latitude},${aed.longitude}(${encodeURIComponent(aed.name)})`;
      window.open(url, "_system");
    }
  };

  if (loading) {
    return (
      <IonContent className="ion-padding">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <IonSpinner />
          <IonText>Cargando {name}...</IonText>
        </div>
      </IonContent>
    );
  }

  if (error || !aed) {
    return (
      <IonContent className="ion-padding">
        <IonText color="danger">{error || "DEA no encontrado"}</IonText>
      </IonContent>
    );
  }

  return (
    <IonContent className="ion-padding">
      <IonText>
        <h2 style={{ marginTop: 0, marginBottom: 4 }}>{aed.name}</h2>
      </IonText>

      {aed.code && (
        <IonChip color="primary" style={{ marginBottom: 8 }}>
          <IonLabel>{aed.code}</IonLabel>
        </IonChip>
      )}

      {aed.establishment_type && (
        <IonChip color="medium" style={{ marginBottom: 12 }}>
          <IonLabel>{aed.establishment_type}</IonLabel>
        </IonChip>
      )}

      {/* Address */}
      {aed.location && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 12 }}>
          <IonIcon icon={location} style={{ fontSize: 20, marginTop: 2, color: "var(--ion-color-primary)" }} />
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

      {/* Schedule */}
      {aed.schedule && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
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

      {/* Contact */}
      {aed.responsible?.phone && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <IonIcon icon={call} style={{ fontSize: 20, color: "var(--ion-color-primary)" }} />
          <IonText>
            <p style={{ margin: 0 }}>{aed.responsible.phone}</p>
          </IonText>
        </div>
      )}

      <IonButton expand="block" onClick={handleNavigate} style={{ marginTop: 16 }}>
        <IonIcon icon={navigateIcon} slot="start" />
        Cómo llegar
      </IonButton>
    </IonContent>
  );
};

export default AedDetailSheet;
