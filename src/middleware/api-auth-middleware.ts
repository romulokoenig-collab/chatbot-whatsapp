import type { Request, Response, NextFunction } from "express";
import { env } from "../config/environment-config.js";

/** Validates x-api-key header against API_KEY env var */
export function apiAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey || apiKey !== env.API_KEY) {
    res.status(401).json({ error: "Unauthorized: invalid or missing API key" });
    return;
  }

  next();
}
