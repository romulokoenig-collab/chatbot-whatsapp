import type { Request, Response, NextFunction } from "express";

/** Global error handler — logs error, returns safe 500 response */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error("[ErrorHandler]", err.message, err.stack);
  res.status(500).json({ error: "Internal server error" });
}
