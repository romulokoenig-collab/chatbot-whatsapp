import type { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger.js";
import { AppError } from "../utils/app-error.js";

/** Global error handler — maps AppError to structured responses, logs internals */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    logger.error({ statusCode: err.statusCode, code: err.code, err }, "[ErrorHandler] AppError");
    const body: Record<string, unknown> = { error: { code: err.code, message: err.message } };
    if (process.env.NODE_ENV !== "production") body.stack = err.stack;
    res.status(err.statusCode).json(body);
    return;
  }

  logger.error({ err }, "[ErrorHandler] Unhandled error");
  const body: Record<string, unknown> = { error: { code: "INTERNAL_ERROR", message: "Internal server error" } };
  if (process.env.NODE_ENV !== "production") body.stack = err.stack;
  res.status(500).json(body);
}
