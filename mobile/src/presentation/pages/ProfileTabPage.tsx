import React from "react";
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
} from "@ionic/react";
import { useHistory } from "react-router-dom";
import {
  logOut,
  person,
  mail,
  shield,
  heartOutline,
  logInOutline,
  personAddOutline,
  addCircleOutline,
} from "ionicons/icons";

import { useAuth } from "../hooks/useAuth";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  MODERATOR: "Moderador",
  USER: "Usuario",
};

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
        <IonContent className="ion-padding">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "60vh",
              gap: 16,
              textAlign: "center",
              padding: 32,
            }}
          >
            <IonIcon icon={heartOutline} style={{ fontSize: 72, color: "#16a34a" }} />
            <h2 style={{ margin: 0, fontSize: 22 }}>DeaMap</h2>
            <p style={{ color: "var(--ion-color-medium)", margin: 0 }}>
              Inicia sesión para contribuir registrando nuevos desfibriladores y ayudar a salvar
              vidas.
            </p>
            <IonButton
              expand="block"
              onClick={() => history.push("/login")}
              style={{ width: "100%", maxWidth: 300, marginTop: 8 }}
            >
              <IonIcon icon={logInOutline} slot="start" />
              Iniciar sesión
            </IonButton>
            <IonButton
              expand="block"
              fill="outline"
              onClick={() => history.push("/register")}
              style={{ width: "100%", maxWidth: 300 }}
            >
              <IonIcon icon={personAddOutline} slot="start" />
              Registrarse
            </IonButton>
          </div>
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
