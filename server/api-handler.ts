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
  await ensureBooted();

  if (initError) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Server init failed", message: initError }));
    return;
  }

  app(req, res);
}
