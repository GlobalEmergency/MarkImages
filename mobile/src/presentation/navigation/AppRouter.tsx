import React from "react";
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  IonRouterOutlet,
  IonLoading,
} from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { Route, Redirect } from "react-router-dom";
import { map, addCircle, person } from "ionicons/icons";

import { useAuth } from "../hooks/useAuth";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import MapPage from "../pages/MapPage";
import NewDeaPage from "../pages/NewDeaPage";
import ProfilePage from "../pages/ProfilePage";

const AppRouter: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <IonLoading isOpen message="Cargando..." />;
  }

  return (
    <IonReactRouter>
      {!isAuthenticated ? (
        <IonRouterOutlet>
          <Route exact path="/login" component={LoginPage} />
          <Route exact path="/register" component={RegisterPage} />
          <Redirect to="/login" />
        </IonRouterOutlet>
      ) : (
        <IonTabs>
          <IonRouterOutlet>
            <Route exact path="/map" component={MapPage} />
            <Route exact path="/new-dea" component={NewDeaPage} />
            <Route exact path="/profile" component={ProfilePage} />
            <Redirect exact from="/" to="/map" />
            <Redirect to="/map" />
          </IonRouterOutlet>
          <IonTabBar slot="bottom">
            <IonTabButton tab="map" href="/map">
              <IonIcon icon={map} />
              <IonLabel>Mapa</IonLabel>
            </IonTabButton>
            <IonTabButton tab="new-dea" href="/new-dea">
              <IonIcon icon={addCircle} />
              <IonLabel>Nuevo DEA</IonLabel>
            </IonTabButton>
            <IonTabButton tab="profile" href="/profile">
              <IonIcon icon={person} />
              <IonLabel>Perfil</IonLabel>
            </IonTabButton>
          </IonTabBar>
        </IonTabs>
      )}
    </IonReactRouter>
  );
};

export default AppRouter;
