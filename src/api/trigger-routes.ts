import { Router } from "express";
import type { Request, Response } from "express";
import { getUnrespondedLeads, getUnfollowedLeads } from "../services/trigger-service.js";

export const triggerRoutes = Router();

/** GET /api/triggers/no-response?hours=24 — leads waiting for agent response */
triggerRoutes.get("/triggers/no-response", async (req: Request, res: Response) => {
  try {
    const hours = Number(req.query.hours ?? 24);

    if (isNaN(hours) || hours < 0) {
      res.status(400).json({ error: "hours must be a non-negative number" });
      return;
    }

    const data = await getUnrespondedLeads(hours);
    res.json({ data, count: data.length, hours });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

/** GET /api/triggers/no-followup?hours=48 — leads waiting for customer reply */
triggerRoutes.get("/triggers/no-followup", async (req: Request, res: Response) => {
  try {
    const hours = Number(req.query.hours ?? 48);

    if (isNaN(hours) || hours < 0) {
      res.status(400).json({ error: "hours must be a non-negative number" });
      return;
    }

    const data = await getUnfollowedLeads(hours);
    res.json({ data, count: data.length, hours });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
