import express from "express";
import { createServer } from "http";
import { registerRoutes } from "./routes";

const app = express();
const server = createServer(app);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));

let initPromise: Promise<void> | null = null;
let initError: string | null = null;

function ensureBooted() {
  if (!initPromise) {
    initPromise = registerRoutes(server, app)
      .then(() => {
        console.log("[api] Routes registered");
      })
      .catch((err) => {
        console.error("[api] Boot failed:", err);
        initError = err?.message || String(err);
      });
  }
  return initPromise;
}

export default async function vercelHandler(req: any, res: any) {
  // Temporary debug endpoint
  if (req.url === "/api/debug-env") {
    const url = process.env.SUPABASE_URL || "";
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({
      hasDbUrl: !!process.env.DATABASE_URL,
      supabaseUrl: url ? url.substring(0, 30) + "..." : "MISSING",
      supabaseKeyPrefix: key ? key.substring(0, 10) + "..." : "MISSING",
      supabaseKeyLength: key.length,
      hasSessionSecret: !!process.env.SESSION_SECRET,
      nodeEnv: process.env.NODE_ENV,
    }));
    return;
  }

  await ensureBooted();

  if (initError) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Server init failed", message: initError }));
    return;
  }

  app(req, res);
}
