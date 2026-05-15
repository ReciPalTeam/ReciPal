import * as Sentry from "@sentry/node";
import type { Express } from "express";

/**
 * Initialize Sentry as early as possible in the process lifecycle.
 *
 *  - No-op when `SENTRY_BACKEND_DSN` is unset, so dev / CI runs without sending events.
 *  - Tags errors with the current environment so prod issues don't drown in dev noise.
 *  - tracesSampleRate is low (0.1) since we mostly care about errors, not perf traces.
 */
export function initSentryBackend(): void {
  const dsn = process.env.SENTRY_BACKEND_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

/** Mount the Sentry Express error handler. Call AFTER routes, BEFORE the app's own error mw. */
export function attachSentryErrorHandler(app: Express): void {
  if (!process.env.SENTRY_BACKEND_DSN) return;
  Sentry.setupExpressErrorHandler(app);
}

export { Sentry };
