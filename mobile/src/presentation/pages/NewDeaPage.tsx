import React, { useCallback, useEffect, useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonButton,
  IonText,
  IonSpinner,
  useIonToast,
} from "@ionic/react";
import { useHistory } from "react-router-dom";

import { Coordinates } from "../../domain/models/Location";
import { createAedUseCase, reverseGeocodeService } from "../../infrastructure/di/container";
import LocationPicker from "../components/LocationPicker";
import { useGeolocation } from "../hooks/useGeolocation";

const ESTABLISHMENT_TYPES = [
  "Farmacia",
  "Centro comercial",
  "Edificio público",
  "Centro deportivo",
  "Centro educativo",
  "Hotel",
  "Estación de transporte",
  "Otro",
];

const NewDeaPage: React.FC = () => {
  const [name, setName] = useState("");
  const [establishmentType, setEstablishmentType] = useState("");
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [streetName, setStreetName] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [observations, setObservations] = useState("");
  const [loading, setLoading] = useState(false);

  const { getCurrentPosition, position } = useGeolocation();
  const history = useHistory();
  const [presentToast] = useIonToast();

  // Get user location on mount
  useEffect(() => {
    getCurrentPosition();
  }, [getCurrentPosition]);

  // Reverse geocode when coords change
  useEffect(() => {
    if (!coords) return;
    let cancelled = false;
    const controller = new AbortController();

    reverseGeocodeService
      .reverse(coords, controller.signal)
      .then((result) => {
        if (!cancelled && result) {
          setStreetName(result.streetName);
          setStreetNumber(result.streetNumber);
          setPostalCode(result.postalCode);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [coords]);

  const handleLocationChange = useCallback((newCoords: Coordinates) => {
    setCoords(newCoords);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!coords) {
      presentToast({
        message: "Selecciona una ubicación en el mapa",
        duration: 3000,
        color: "warning",
        position: "top",
      });
      return;
    }

    setLoading(true);
    try {
      await createAedUseCase.execute({
        name,
        establishment_type: establishmentType || undefined,
        latitude: coords.latitude,
        longitude: coords.longitude,
        location: {
          street_name: streetName || undefined,
          street_number: streetNumber || undefined,
          postal_code: postalCode || undefined,
        },
        source_details: observations || undefined,
      });

      presentToast({
        message: "DEA registrado correctamente. Será revisado por un administrador.",
        duration: 4000,
        color: "success",
        position: "top",
      });

      history.push("/tabs/map");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al registrar el DEA";
      presentToast({ message, duration: 3000, color: "danger", position: "top" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Registrar DEA</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonText>
          <p style={{ color: "var(--ion-color-medium)", marginTop: 0 }}>
            Registra un nuevo desfibrilador. Será revisado antes de publicarse.
          </p>
        </IonText>

        <form onSubmit={handleSubmit}>
          <IonInput
            label="Nombre del lugar *"
            labelPlacement="floating"
            fill="outline"
            value={name}
            onIonInput={(e) => setName(e.detail.value || "")}
            required
            placeholder="Ej: Farmacia Central, Centro Deportivo..."
            style={{ marginBottom: 16 }}
          />

          <IonSelect
            label="Tipo de establecimiento"
            labelPlacement="floating"
            fill="outline"
            value={establishmentType}
            onIonChange={(e) => setEstablishmentType(e.detail.value)}
            style={{ marginBottom: 16 }}
          >
            {ESTABLISHMENT_TYPES.map((type) => (
              <IonSelectOption key={type} value={type}>
                {type}
              </IonSelectOption>
            ))}
          </IonSelect>

          <IonText>
            <p style={{ fontWeight: 600, marginBottom: 8 }}>Ubicación *</p>
            <p
              style={{
                fontSize: 13,
                color: "var(--ion-color-medium)",
                marginTop: 0,
                marginBottom: 8,
              }}
            >
              Toca el mapa o arrastra el marcador para ajustar la posición
            </p>
          </IonText>

          <LocationPicker initialPosition={position || undefined} onChange={handleLocationChange} />

          {coords && (
            <IonText>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--ion-color-medium)",
                  textAlign: "center",
                  margin: "4px 0 16px",
                }}
              >
                {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
              </p>
            </IonText>
          )}

          <IonInput
            label="Calle"
            labelPlacement="floating"
            fill="outline"
            value={streetName}
            onIonInput={(e) => setStreetName(e.detail.value || "")}
            style={{ marginBottom: 16 }}
          />

          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <IonInput
              label="Número"
              labelPlacement="floating"
              fill="outline"
              value={streetNumber}
              onIonInput={(e) => setStreetNumber(e.detail.value || "")}
              style={{ flex: 1 }}
            />
            <IonInput
              label="Código postal"
              labelPlacement="floating"
              fill="outline"
              value={postalCode}
              onIonInput={(e) => setPostalCode(e.detail.value || "")}
              style={{ flex: 1 }}
            />
          </div>

          <IonTextarea
            label="Observaciones"
            labelPlacement="floating"
            fill="outline"
            value={observations}
            onIonInput={(e) => setObservations(e.detail.value || "")}
            placeholder="¿Cómo encontraste este DEA?"
            rows={3}
            style={{ marginBottom: 24 }}
          />

          <IonButton expand="block" type="submit" disabled={loading || !name || !coords}>
            {loading ? <IonSpinner name="crescent" /> : "Registrar DEA"}
          </IonButton>
        </form>
      </IonContent>
    </IonPage>
  );
};

export default NewDeaPage;
