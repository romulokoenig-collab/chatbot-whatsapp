/**
 * Unit tests for apiAuthMiddleware.
 *
 * The middleware reads env.API_KEY from environment-config.ts which calls
 * process.exit(1) if required env vars are absent. We set the minimum required
 * env vars before any import so the module loads cleanly.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Set env vars BEFORE importing anything that triggers environment-config.ts
beforeAll(() => {
  process.env.SUPABASE_URL = "https://fake.supabase.co";
  process.env.SUPABASE_ANON_KEY = "fake-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key";
  process.env.API_KEY = "test-secret-key";
  process.env.NODE_ENV = "test";
});

// ── helpers ───────────────────────────────────────────────────────────────────

function makeReq(headers: Record<string, string> = {}): Partial<Request> {
  return { headers } as Partial<Request>;
}

function makeRes(): { res: Partial<Response>; statusCode: number | undefined; body: unknown } {
  const ctx = { statusCode: undefined as number | undefined, body: undefined as unknown };
  const res: Partial<Response> = {
    status(code: number) {
      ctx.statusCode = code;
      return res as Response;
    },
    json(data: unknown) {
      ctx.body = data;
      return res as Response;
    },
  };
  return { res, statusCode: ctx.statusCode, body: ctx.body };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("apiAuthMiddleware", () => {
  it("calls next() when x-api-key matches API_KEY env var", async () => {
    // Dynamic import AFTER env vars are set
    const { apiAuthMiddleware } = await import("../middleware/api-auth-middleware.js");

    const req = makeReq({ "x-api-key": "test-secret-key" });
    const { res } = makeRes();
    const next = vi.fn();

    apiAuthMiddleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
  });

  it("returns 401 when x-api-key header is missing", async () => {
    const { apiAuthMiddleware } = await import("../middleware/api-auth-middleware.js");

    const req = makeReq({});
    const { res } = makeRes();
    let capturedStatus: number | undefined;
    let capturedBody: unknown;

    const mockRes: Partial<Response> = {
      status(code: number) {
        capturedStatus = code;
        return mockRes as Response;
      },
      json(data: unknown) {
        capturedBody = data;
        return mockRes as Response;
      },
    };

    const next = vi.fn();
    apiAuthMiddleware(req as Request, mockRes as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(capturedStatus).toBe(401);
    expect(capturedBody).toMatchObject({ error: expect.stringContaining("Unauthorized") });
  });

  it("returns 401 when x-api-key header is present but wrong", async () => {
    const { apiAuthMiddleware } = await import("../middleware/api-auth-middleware.js");

    const req = makeReq({ "x-api-key": "wrong-key" });
    let capturedStatus: number | undefined;
    let capturedBody: unknown;

    const mockRes: Partial<Response> = {
      status(code: number) {
        capturedStatus = code;
        return mockRes as Response;
      },
      json(data: unknown) {
        capturedBody = data;
        return mockRes as Response;
      },
    };

    const next = vi.fn();
    apiAuthMiddleware(req as Request, mockRes as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(capturedStatus).toBe(401);
    expect(capturedBody).toMatchObject({ error: expect.stringContaining("Unauthorized") });
  });

  it("returns 401 when x-api-key is an empty string", async () => {
    const { apiAuthMiddleware } = await import("../middleware/api-auth-middleware.js");

    const req = makeReq({ "x-api-key": "" });
    let capturedStatus: number | undefined;

    const mockRes: Partial<Response> = {
      status(code: number) {
        capturedStatus = code;
        return mockRes as Response;
      },
      json() {
        return mockRes as Response;
      },
    };

    const next = vi.fn();
    apiAuthMiddleware(req as Request, mockRes as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(capturedStatus).toBe(401);
  });
});
