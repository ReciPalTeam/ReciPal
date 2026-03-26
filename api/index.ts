import express from "express";
import { registerRoutes } from "../server/routes";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false }));

// Register all routes
await registerRoutes(httpServer, app);

export default app;
