import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initSentryFrontend, AppErrorBoundary } from "./lib/sentry";

// Initialize before render so crashes during initial component mount get captured.
initSentryFrontend();

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
