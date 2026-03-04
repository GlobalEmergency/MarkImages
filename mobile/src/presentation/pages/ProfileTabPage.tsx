import React, { useState } from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonList,
  IonItem,
  IonLabel,
  IonChip,
  IonInput,
  IonText,
  IonLoading,
  IonSpinner,
  useIonToast,
} from "@ionic/react";
import { useHistory } from "react-router-dom";
import { logOut, person, mail, shield, addCircleOutline } from "ionicons/icons";

import { useAuth } from "../hooks/useAuth";
import { promptSaveCredentials } from "../../infrastructure/auth/CredentialService";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  MODERATOR: "Moderador",
  USER: "Usuario",
};

/* ---------- Inline Auth Form (login + register toggle) ---------- */

const AuthForm: React.FC = () => {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const [presentToast] = useIonToast();

  const resetFields = () => {
    setEmail("");
    setPassword("");
    setName("");
    setConfirmPassword("");
  };

  const toggleMode = () => {
    resetFields();
    setMode((m) => (m === "login" ? "register" : "login"));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      await promptSaveCredentials(email, password);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al iniciar sesión";
      presentToast({ message, duration: 3000, color: "danger", position: "top" });
    } finally {
      setLoading(false);
    }
  };

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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error al registrarse";
      presentToast({ message, duration: 3000, color: "danger", position: "top" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "70vh",
        maxWidth: 400,
        margin: "0 auto",
        padding: "24px 16px",
      }}
    >
      {/* App branding */}
      <img src="/icon-96x96.png" alt="DeaMap" style={{ width: 72, height: 72, marginBottom: 8 }} />
      <IonText>
        <h2 style={{ textAlign: "center", margin: "0 0 4px" }}>DeaMap</h2>
        <p
          style={{
            textAlign: "center",
            color: "var(--ion-color-medium)",
            margin: "0 0 24px",
            fontSize: 14,
          }}
        >
          {mode === "login"
            ? "Inicia sesión para contribuir registrando desfibriladores"
            : "Crea tu cuenta para ayudar a salvar vidas"}
        </p>
      </IonText>

      {/* ---- Login form ---- */}
      {mode === "login" && (
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
      )}

      {/* ---- Register form ---- */}
      {mode === "register" && (
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
      )}

      {/* Toggle link */}
      <IonButton fill="clear" size="small" onClick={toggleMode} style={{ marginTop: 12 }}>
        {mode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
      </IonButton>

      <IonLoading
        isOpen={loading}
        message={mode === "login" ? "Iniciando sesión..." : "Creando cuenta..."}
      />
    </div>
  );
};

/* ---------- Profile Tab Page ---------- */

const ProfileTabPage: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const history = useHistory();

  if (!isAuthenticated || !user) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Perfil</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding" scrollY>
          <AuthForm />
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Perfil</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: "var(--ion-color-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 12px",
            }}
          >
            <IonIcon icon={person} style={{ fontSize: 40, color: "white" }} />
          </div>
          <h2 style={{ margin: "0 0 4px" }}>{user.name}</h2>
          <IonChip color="primary">
            <IonIcon icon={shield} />
            <IonLabel>{ROLE_LABELS[user.role] || user.role}</IonLabel>
          </IonChip>
        </div>

        <IonList>
          <IonItem>
            <IonIcon icon={mail} slot="start" color="primary" />
            <IonLabel>
              <p>Email</p>
              <h3>{user.email}</h3>
            </IonLabel>
          </IonItem>
          <IonItem>
            <IonIcon icon={person} slot="start" color="primary" />
            <IonLabel>
              <p>Nombre</p>
              <h3>{user.name}</h3>
            </IonLabel>
          </IonItem>
        </IonList>

        <IonButton
          expand="block"
          onClick={() => history.push("/new-dea")}
          style={{ marginTop: 24 }}
        >
          <IonIcon icon={addCircleOutline} slot="start" />
          Registrar nuevo DEA
        </IonButton>

        <IonButton
          expand="block"
          color="danger"
          fill="outline"
          onClick={() => logout()}
          style={{ marginTop: 12 }}
        >
          <IonIcon icon={logOut} slot="start" />
          Cerrar sesión
        </IonButton>
      </IonContent>
    </IonPage>
  );
};

export default ProfileTabPage;
