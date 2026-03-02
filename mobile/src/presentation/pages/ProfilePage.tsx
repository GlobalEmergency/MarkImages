import React from "react";
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonIcon,
  IonChip,
} from "@ionic/react";
import { logOut, person, mail, shield } from "ionicons/icons";

import { useAuth } from "../hooks/useAuth";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  MODERATOR: "Moderador",
  USER: "Usuario",
};

const ProfilePage: React.FC = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
  };

  if (!user) return null;

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
          color="danger"
          fill="outline"
          onClick={handleLogout}
          style={{ marginTop: 32 }}
        >
          <IonIcon icon={logOut} slot="start" />
          Cerrar sesión
        </IonButton>
      </IonContent>
    </IonPage>
  );
};

export default ProfilePage;
