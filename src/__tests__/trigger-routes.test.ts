/**
 * Integration-style tests for GET /api/triggers/no-response and /api/triggers/no-followup.
 *
 * Strategy:
 * - Mock ../services/trigger-service.js so no real Supabase calls are made.
 * - Mock ../config/supabase-client.js to prevent module-load side effects.
 * - Build a minimal Express app that mounts apiAuthMiddleware + triggerRoutes
 *   so auth is exercised alongside the route logic.
 * - Use supertest to fire HTTP requests.
 */

import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import request from "supertest";
import express from "express";

// ── env vars must be set before any local module import ───────────────────────
beforeAll(() => {
  process.env.SUPABASE_URL = "https://fake.supabase.co";
  process.env.SUPABASE_ANON_KEY = "fake-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-key";
  process.env.API_KEY = "test-api-key";
  process.env.WHATSAPP_APP_SECRET = "test-app-secret";
  process.env.NODE_ENV = "test";
});

// ── mock Supabase client so the module doesn't try to connect ─────────────────
vi.mock("../config/supabase-client.js", () => ({
  supabase: {},
}));

// ── mock trigger-service ──────────────────────────────────────────────────────
const mockGetUnrespondedLeads = vi.fn();
const mockGetUnfollowedLeads = vi.fn();

vi.mock("../services/trigger-service.js", () => ({
  getUnrespondedLeads: (...args: unknown[]) => mockGetUnrespondedLeads(...args),
  getUnfollowedLeads: (...args: unknown[]) => mockGetUnfollowedLeads(...args),
}));

afterEach(() => {
  vi.clearAllMocks();
});

// ── build test app ────────────────────────────────────────────────────────────
async function buildApp() {
  const { apiAuthMiddleware } = await import("../middleware/api-auth-middleware.js");
  const { triggerRoutes } = await import("../api/trigger-routes.js");
  const { errorHandler } = await import("../middleware/error-handler.js");

  const app = express();
  app.use(express.json());
  app.use("/api", apiAuthMiddleware);
  app.use("/api", triggerRoutes);
  app.use(errorHandler);
  return app;
}

// ── /api/triggers/no-response ─────────────────────────────────────────────────

describe("GET /api/triggers/no-response", () => {
  it("returns 401 when API key is missing", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/triggers/no-response");
    expect(res.status).toBe(401);
  });

  it("returns 401 when API key is wrong", async () => {
    const app = await buildApp();
    const res = await request(app)
      .get("/api/triggers/no-response")
      .set("x-api-key", "bad-key");
    expect(res.status).toBe(401);
  });

  it("returns 200 with data array and count using default hours=24", async () => {
    const fakeLeads = [{ id: "conv-1" }, { id: "conv-2" }];
    mockGetUnrespondedLeads.mockResolvedValue(fakeLeads);

    const app = await buildApp();
    const res = await request(app)
      .get("/api/triggers/no-response")
      .set("x-api-key", "test-api-key");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(fakeLeads);
    expect(res.body.count).toBe(2);
    expect(res.body.hours).toBe(24);
    expect(mockGetUnrespondedLeads).toHaveBeenCalledWith(24);
  });

  it("passes custom hours query param to service", async () => {
    mockGetUnrespondedLeads.mockResolvedValue([]);

    const app = await buildApp();
    const res = await request(app)
      .get("/api/triggers/no-response?hours=48")
      .set("x-api-key", "test-api-key");

    expect(res.status).toBe(200);
    expect(res.body.hours).toBe(48);
    expect(mockGetUnrespondedLeads).toHaveBeenCalledWith(48);
  });

  it("returns 400 when hours is not a valid number", async () => {
    const app = await buildApp();
    const res = await request(app)
      .get("/api/triggers/no-response?hours=abc")
      .set("x-api-key", "test-api-key");

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/hours/i);
  });

  it("returns 400 when hours is negative", async () => {
    const app = await buildApp();
    const res = await request(app)
      .get("/api/triggers/no-response?hours=-5")
      .set("x-api-key", "test-api-key");

    expect(res.status).toBe(400);
  });

  it("returns 500 when service throws an error", async () => {
    mockGetUnrespondedLeads.mockRejectedValue(new Error("DB connection failed"));

    const app = await buildApp();
    const res = await request(app)
      .get("/api/triggers/no-response")
      .set("x-api-key", "test-api-key");

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });

  it("returns empty data array and count=0 when no leads found", async () => {
    mockGetUnrespondedLeads.mockResolvedValue([]);

    const app = await buildApp();
    const res = await request(app)
      .get("/api/triggers/no-response")
      .set("x-api-key", "test-api-key");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.count).toBe(0);
  });
});

// ── /api/triggers/no-followup ─────────────────────────────────────────────────

describe("GET /api/triggers/no-followup", () => {
  it("returns 401 when API key is missing", async () => {
    const app = await buildApp();
    const res = await request(app).get("/api/triggers/no-followup");
    expect(res.status).toBe(401);
  });

  it("returns 200 with data and default hours=48", async () => {
    const fakeLeads = [{ id: "conv-3" }];
    mockGetUnfollowedLeads.mockResolvedValue(fakeLeads);

    const app = await buildApp();
    const res = await request(app)
      .get("/api/triggers/no-followup")
      .set("x-api-key", "test-api-key");

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual(fakeLeads);
    expect(res.body.count).toBe(1);
    expect(res.body.hours).toBe(48);
    expect(mockGetUnfollowedLeads).toHaveBeenCalledWith(48);
  });

  it("passes custom hours query param to service", async () => {
    mockGetUnfollowedLeads.mockResolvedValue([]);

    const app = await buildApp();
    const res = await request(app)
      .get("/api/triggers/no-followup?hours=72")
      .set("x-api-key", "test-api-key");

    expect(res.status).toBe(200);
    expect(res.body.hours).toBe(72);
    expect(mockGetUnfollowedLeads).toHaveBeenCalledWith(72);
  });

  it("returns 400 when hours is NaN", async () => {
    const app = await buildApp();
    const res = await request(app)
      .get("/api/triggers/no-followup?hours=not-a-number")
      .set("x-api-key", "test-api-key");

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/hours/i);
  });

  it("returns 400 when hours is negative", async () => {
    const app = await buildApp();
    const res = await request(app)
      .get("/api/triggers/no-followup?hours=-1")
      .set("x-api-key", "test-api-key");

    expect(res.status).toBe(400);
  });

  it("returns 500 when service throws", async () => {
    mockGetUnfollowedLeads.mockRejectedValue(new Error("timeout"));

    const app = await buildApp();
    const res = await request(app)
      .get("/api/triggers/no-followup")
      .set("x-api-key", "test-api-key");

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });

  it("accepts hours=0 as valid (boundary value)", async () => {
    mockGetUnfollowedLeads.mockResolvedValue([]);

    const app = await buildApp();
    const res = await request(app)
      .get("/api/triggers/no-followup?hours=0")
      .set("x-api-key", "test-api-key");

    expect(res.status).toBe(200);
    expect(res.body.hours).toBe(0);
    expect(mockGetUnfollowedLeads).toHaveBeenCalledWith(0);
  });
});
