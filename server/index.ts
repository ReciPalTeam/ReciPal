// Sentry's auto-instrumentation runs via `--import ./server/instrument.ts` in the dev/start
// scripts (must preload before any other module imports). We only need the error-handler
// helper here.
import { attachSentryErrorHandler, Sentry } from "./lib/sentry";

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

// Process-level safety net. The targeted pool 'error' handler in db.ts already makes
// transient DB blips non-fatal; these catch everything else so a stray rejection or
// throw is logged + reported rather than silently killing the server.
// - unhandledRejection: log + capture, keep running (one bad promise shouldn't kill the box).
// - uncaughtException: the process is now in an undefined state, so flush Sentry and exit(1)
//   for a clean supervisor restart (Fly.io in prod). In dev this surfaces the crash loudly
//   instead of the silent death we were seeing.
process.on("unhandledRejection", (reason) => {
  console.error("[process] unhandledRejection (non-fatal):", reason);
  Sentry.captureException(reason);
});
process.on("uncaughtException", (err) => {
  console.error("[process] uncaughtException — flushing Sentry and exiting:", err);
  Sentry.captureException(err);
  void Sentry.flush(2000).finally(() => process.exit(1));
});

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// FFmpeg.wasm needs SharedArrayBuffer, which requires cross-origin isolation. The chef-upload
// page (and any future WASM-heavy pages) won't work without these headers. COEP=credentialless
// keeps the unpkg CDN load for ffmpeg-core working without explicit CORP on the CDN side.
app.use((_req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  // Sentry must see errors before our own handler swallows them.
  attachSentryErrorHandler(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // Serve the app on the port specified in PORT env var.
  // On Replit/Vercel, 0.0.0.0 binding is required. Locally, 127.0.0.1 is safer
  // (not exposed to LAN) and avoids macOS firewall prompts / AirPlay port conflicts.
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.env.HOST || "127.0.0.1";
  httpServer.listen(
    {
      port,
      host,
    },
    () => {
      log(`serving on port ${port} (${host})`);
    },
  );
})();
