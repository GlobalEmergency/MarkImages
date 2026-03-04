import React, { useState } from "react";
import {
  IonPage,
  IonContent,
  IonInput,
  IonButton,
  IonText,
  IonLoading,
  IonSpinner,
  useIonToast,
} from "@ionic/react";
import { useHistory } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { promptSaveCredentials } from "../../infrastructure/auth/CredentialService";

/**
 * Standalone register page — used when AuthGuard redirects here.
 * The primary registration flow is now inline in ProfileTabPage.
 */
const RegisterPage: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const history = useHistory();
  const [presentToast] = useIonToast();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      presentToast({
        message: "Las contraseñas no coinciden",
        duration: 3000,
        color: "warning",
        position: "top",
      });
      return;
    }

    setLoading(true);
    try {
      await register(name, email, password);
      await promptSaveCredentials(email, password);
      history.replace("/tabs/profile");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al registrarse";
      presentToast({ message, duration: 3000, color: "danger", position: "top" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100%",
            maxWidth: 400,
            margin: "0 auto",
          }}
        >
          <img
            src="/icon-96x96.png"
            alt="DeaMap"
            style={{ width: 64, height: 64, marginBottom: 8 }}
          />
          <IonText>
            <h1 style={{ textAlign: "center", marginBottom: 8 }}>Crear cuenta</h1>
            <p style={{ textAlign: "center", color: "var(--ion-color-medium)", marginBottom: 24 }}>
              Regístrate para contribuir al mapa de DEAs
            </p>
          </IonText>

          <form onSubmit={handleRegister} style={{ width: "100%" }} autoComplete="on">
            <IonInput
              type="text"
              name="name"
              label="Nombre"
              labelPlacement="floating"
              fill="outline"
              value={name}
              autocomplete="name"
              onIonInput={(e) => setName(e.detail.value || "")}
              required
              style={{ marginBottom: 16 }}
            />
            <IonInput
              type="email"
              name="email"
              label="Email"
              labelPlacement="floating"
              fill="outline"
              value={email}
              autocomplete="email"
              inputMode="email"
              onIonInput={(e) => setEmail(e.detail.value || "")}
              required
              style={{ marginBottom: 16 }}
            />
            <IonInput
              type="password"
              name="password"
              label="Contraseña"
              labelPlacement="floating"
              fill="outline"
              value={password}
              autocomplete="new-password"
              onIonInput={(e) => setPassword(e.detail.value || "")}
              required
              helperText="Mínimo 8 caracteres, con mayúscula, minúscula y número"
              style={{ marginBottom: 16 }}
            />
            <IonInput
              type="password"
              name="confirm-password"
              label="Confirmar contraseña"
              labelPlacement="floating"
              fill="outline"
              value={confirmPassword}
              autocomplete="new-password"
              onIonInput={(e) => setConfirmPassword(e.detail.value || "")}
              required
              style={{ marginBottom: 24 }}
            />
            <IonButton expand="block" type="submit" disabled={loading}>
              {loading ? <IonSpinner name="crescent" /> : "Crear cuenta"}
            </IonButton>
          </form>

          <IonButton
            fill="clear"
            size="small"
            onClick={() => history.push("/login")}
            style={{ marginTop: 16 }}
          >
            ¿Ya tienes cuenta? Inicia sesión
          </IonButton>
        </div>

        <IonLoading isOpen={loading} message="Creando cuenta..." />
      </IonContent>
    </IonPage>
  );
};

export default RegisterPage;
