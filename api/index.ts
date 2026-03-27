import type { IncomingMessage, ServerResponse } from "http";

let handler: ((req: IncomingMessage, res: ServerResponse) => void) | null = null;
let initPromise: Promise<void> | null = null;
let initError: string | null = null;

async function boot() {
  const express = (await import("express")).default;
  const { createServer } = await import("http");
  const { registerRoutes } = await import("../server/routes");

  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: false }));

  await registerRoutes(server, app);
  console.log("[api] Routes registered");
  handler = app;
}

function ensureBooted() {
  if (!initPromise) {
    initPromise = boot().catch((err) => {
      console.error("[api] Boot failed:", err);
      initError = err?.message || String(err);
    });
  }
  return initPromise;
}

export default async function vercelHandler(req: any, res: any) {
  await ensureBooted();

  if (initError) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Server init failed", message: initError }));
    return;
  }

  handler!(req, res);
}
