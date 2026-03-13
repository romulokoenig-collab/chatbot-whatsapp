import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { getUnrespondedLeads, getUnfollowedLeads } from "../services/trigger-service.js";
import { AppError } from "../utils/app-error.js";

export const triggerRoutes = Router();

function parseHours(raw: unknown, defaultHours: number): number {
  const hours = Number(raw ?? defaultHours);
  if (isNaN(hours) || hours < 0) throw AppError.badRequest("hours must be a non-negative number");
  return hours;
}

/** GET /api/triggers/no-response?hours=24 — leads waiting for agent response */
triggerRoutes.get("/triggers/no-response", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hours = parseHours(req.query.hours, 24);
    const data = await getUnrespondedLeads(hours);
    res.json({ data, count: data.length, hours });
  } catch (err) {
    next(err);
  }
});

/** GET /api/triggers/no-followup?hours=48 — leads waiting for customer reply */
triggerRoutes.get("/triggers/no-followup", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hours = parseHours(req.query.hours, 48);
    const data = await getUnfollowedLeads(hours);
    res.json({ data, count: data.length, hours });
  } catch (err) {
    next(err);
  }
});
