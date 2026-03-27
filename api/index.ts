import express from "express";
import { registerRoutes } from "../server/routes";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false }));

let initPromise: Promise<void> | null = null;
let initError: Error | null = null;

function ensureInitialized() {
  if (!initPromise) {
    initPromise = registerRoutes(httpServer, app)
      .then(() => {
        console.log("[api] Routes registered successfully");
      })
      .catch((err) => {
        console.error("[api] Failed to initialize:", err);
        initError = err;
      });
  }
  return initPromise;
}

// Vercel handler
export default async function handler(req: any, res: any) {
  try {
    await ensureInitialized();

    if (initError) {
      return res.status(500).json({
        error: "Server initialization failed",
        message: initError.message,
      });
    }

    app(req, res);
  } catch (err: any) {
    console.error("[api] Handler error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: err.message,
    });
  }
}
