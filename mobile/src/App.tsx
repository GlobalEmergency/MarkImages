import { IonApp, setupIonicReact } from "@ionic/react";

/* Core CSS required for Ionic components to work properly */
import "@ionic/react/css/core.css";

/* Basic CSS for apps built with Ionic */
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";

/* Optional CSS utils */
import "@ionic/react/css/padding.css";
import "@ionic/react/css/float-elements.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/text-transformation.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/display.css";

/* Dark mode support */
import "@ionic/react/css/palettes/dark.system.css";

/* Theme variables */
import "./theme/variables.css";

/* Leaflet (loaded globally to avoid duplication and z-index issues) */
import "leaflet/dist/leaflet.css";

/* Auth provider */
import { AuthProvider } from "./presentation/store/AuthContext";
import AppRouter from "./presentation/navigation/AppRouter";

setupIonicReact();

const App: React.FC = () => (
  <IonApp>
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  </IonApp>
);

export default App;
