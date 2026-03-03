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
import { map, list, person } from "ionicons/icons";

import { useAuth } from "../hooks/useAuth";
import LoginPage from "../pages/LoginPage";
import RegisterPage from "../pages/RegisterPage";
import MapPage from "../pages/MapPage";
import NearbyPage from "../pages/NearbyPage";
import NewDeaPage from "../pages/NewDeaPage";
import ProfileTabPage from "../pages/ProfileTabPage";
import DeaDetailPage from "../pages/DeaDetailPage";
import AuthGuard from "../components/AuthGuard";

const AppRouter: React.FC = () => {
  const { isLoading } = useAuth();

  if (isLoading) {
    return <IonLoading isOpen message="Cargando..." />;
  }

  return (
    <IonReactRouter>
      <IonRouterOutlet>
        {/* Standalone routes (no tab bar) */}
        <Route exact path="/login" component={LoginPage} />
        <Route exact path="/register" component={RegisterPage} />
        <Route exact path="/dea/:id" component={DeaDetailPage} />
        <Route
          exact
          path="/new-dea"
          render={() => (
            <AuthGuard>
              <NewDeaPage />
            </AuthGuard>
          )}
        />

        {/* Tabbed layout (public - no auth required) */}
        <Route
          path="/tabs"
          render={() => (
            <IonTabs>
              <IonRouterOutlet>
                <Route exact path="/tabs/map" component={MapPage} />
                <Route exact path="/tabs/nearby" component={NearbyPage} />
                <Route exact path="/tabs/profile" component={ProfileTabPage} />
                <Redirect exact from="/tabs" to="/tabs/map" />
              </IonRouterOutlet>
              <IonTabBar slot="bottom">
                <IonTabButton tab="map" href="/tabs/map">
                  <IonIcon icon={map} />
                  <IonLabel>Mapa</IonLabel>
                </IonTabButton>
                <IonTabButton tab="nearby" href="/tabs/nearby">
                  <IonIcon icon={list} />
                  <IonLabel>Cercanos</IonLabel>
                </IonTabButton>
                <IonTabButton tab="profile" href="/tabs/profile">
                  <IonIcon icon={person} />
                  <IonLabel>Perfil</IonLabel>
                </IonTabButton>
              </IonTabBar>
            </IonTabs>
          )}
        />

        {/* Default redirect */}
        <Redirect exact from="/" to="/tabs/map" />
      </IonRouterOutlet>
    </IonReactRouter>
  );
};

export default AppRouter;
