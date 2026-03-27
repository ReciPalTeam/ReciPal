import express from "express";
import { registerRoutes } from "../server/routes";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));

let initialized = false;
let initPromise: Promise<void> | null = null;

function ensureInitialized() {
  if (!initPromise) {
    initPromise = registerRoutes(httpServer, app).then(() => {
      initialized = true;
    });
  }
  return initPromise;
}

// Vercel handler — ensure routes are registered before handling
export default async function handler(req: any, res: any) {
  await ensureInitialized();
  app(req, res);
}
