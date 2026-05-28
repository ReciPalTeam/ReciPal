import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./dark-mode-overrides.css";
import { initSentryFrontend, AppErrorBoundary } from "./lib/sentry";

// Apply dark mode from localStorage before React renders so non-LayoutShell
// routes (auth, onboarding, macro-wizard, paywall, share, swatchboard,
// instacart, pro-welcome) inherit the user's theme choice on first paint.
if (localStorage.getItem("theme") === "dark") {
  document.documentElement.classList.add("dark");
}

// Initialize before render so crashes during initial component mount get captured.
initSentryFrontend();

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
