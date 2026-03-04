import React, { useState } from "react";
import {
  IonPage,
  IonContent,
  IonInput,
  IonButton,
  IonText,
  IonSpinner,
  useIonToast,
} from "@ionic/react";
import { useHistory } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import { promptSaveCredentials } from "../../infrastructure/auth/CredentialService";

/**
 * Standalone login page — used when AuthGuard redirects here.
 * The primary login flow is now inline in ProfileTabPage.
 */
const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const history = useHistory();
  const [presentToast] = useIonToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      await promptSaveCredentials(email, password);
      history.replace("/tabs/profile");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al iniciar sesión";
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
            style={{ width: 72, height: 72, marginBottom: 8 }}
          />
          <IonText>
            <h1 style={{ textAlign: "center", marginBottom: 8 }}>DeaMap</h1>
            <p style={{ textAlign: "center", color: "var(--ion-color-medium)", marginBottom: 32 }}>
              Inicia sesión para continuar
            </p>
          </IonText>

          <form onSubmit={handleLogin} style={{ width: "100%" }} autoComplete="on">
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
              autocomplete="current-password"
              onIonInput={(e) => setPassword(e.detail.value || "")}
              required
              style={{ marginBottom: 24 }}
            />
            <IonButton expand="block" type="submit" disabled={loading}>
              {loading ? <IonSpinner name="crescent" /> : "Iniciar sesión"}
            </IonButton>
          </form>

          <IonButton
            fill="clear"
            size="small"
            onClick={() => history.push("/register")}
            style={{ marginTop: 16 }}
          >
            ¿No tienes cuenta? Regístrate
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default LoginPage;
