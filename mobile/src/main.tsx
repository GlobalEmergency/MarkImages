import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { crashReporter } from "./infrastructure/di/container";
import { setupGlobalErrorHandlers } from "./infrastructure/firebase/setupGlobalErrorHandlers";

const container = document.getElementById("root");
const root = createRoot(container!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register global error handlers unconditionally — recordException is already fire-and-forget
setupGlobalErrorHandlers(crashReporter);

// Initialize crash reporting (fire-and-forget, non-blocking)
crashReporter.initialize().catch((err) => {
  console.warn("Failed to initialize crash reporter:", err);
});
