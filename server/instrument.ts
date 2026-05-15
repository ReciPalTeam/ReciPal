// Sentry initialization that runs BEFORE the rest of the app code is imported.
// Loaded via the dev command's `--import ./server/instrument.ts` flag so that
// @sentry/node's auto-instrumentation can hook into Express/HTTP modules before
// they're required. Without this preload step, Sentry logs a "express is not
// instrumented" warning at boot and request-level tracing degrades to no-op.
import { initSentryBackend } from "./lib/sentry";
initSentryBackend();
