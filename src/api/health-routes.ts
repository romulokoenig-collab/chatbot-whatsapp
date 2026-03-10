import { Router } from "express";
import { supabase } from "../config/supabase-client.js";

export const healthRoutes = Router();

/** GET /api/health — health check with DB connectivity test */
healthRoutes.get("/health", async (_req, res) => {
  try {
    const { error } = await supabase.from("conversations").select("id").limit(1);

    if (error) {
      res.status(503).json({ status: "unhealthy", db: "disconnected", error: error.message });
      return;
    }

    res.json({ status: "healthy", db: "connected", timestamp: new Date().toISOString() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(503).json({ status: "unhealthy", db: "error", error: msg });
  }
});
