import { type PropsWithChildren } from "react";
import * as Sentry from "@sentry/react";

/**
 * Initialize Sentry for the React app. No-op when `VITE_SENTRY_DSN` is unset, so dev
 * shells without a DSN don't emit network noise.
 *
 *  - browserTracingIntegration: light perf sampling so we can see slow pageloads.
 *  - replaysOnErrorSampleRate=1.0: capture session replay only on error (privacy + cost win).
 */
export function initSentryFrontend(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE ?? "development",
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
  });
}

/** App-root error boundary. Renders a simple fallback when a child throws. */
export function AppErrorBoundary({ children }: PropsWithChildren) {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-background text-foreground">
          <h1 className="text-xl font-bold mb-2">Something broke.</h1>
          <p className="text-sm text-muted-foreground max-w-md mb-4">
            The error has been logged. Try reloading — if it keeps happening, your support team will see this.
          </p>
          <pre className="text-[10px] text-muted-foreground/60 max-w-md overflow-auto mb-4">
            {error instanceof Error ? error.message : String(error)}
          </pre>
          <button
            onClick={resetError}
            className="px-4 py-2 rounded-md bg-recipal-orange text-white text-sm font-semibold"
          >
            Try again
          </button>
        </div>
      )}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
