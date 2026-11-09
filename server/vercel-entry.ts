import express from "express";
import { registerStoreRoutes } from "./store";
import { publicPlatformScript } from "./_core/publicConfig";

const app = express();
app.use(express.json({ limit: "4mb" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.get("/api/platform/config.js", (_req, res) => {
  res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
});
registerStoreRoutes(app);

export default app;
