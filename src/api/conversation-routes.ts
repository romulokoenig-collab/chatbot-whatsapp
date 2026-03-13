import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../config/logger.js";
import { supabase } from "../config/supabase-client.js";
import { AppError } from "../utils/app-error.js";

export const conversationRoutes = Router();

const VALID_STATUSES = ["active", "closed"] as const;

/** Clamp pagination params to safe ranges */
function parsePagination(query: Record<string, unknown>, defaults = { limit: 50, maxLimit: 200 }) {
  const limit = Math.min(Math.max(Number(query.limit) || defaults.limit, 1), defaults.maxLimit);
  const offset = Math.max(Number(query.offset) || 0, 0);
  return { limit, offset };
}

/** GET /api/conversations — list conversations with filters */
conversationRoutes.get("/conversations", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lead_id, status, since } = req.query;
    const { limit, offset } = parsePagination(req.query as Record<string, unknown>);

    if (status && !VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
      throw AppError.badRequest(`Invalid status. Allowed: ${VALID_STATUSES.join(", ")}`);
    }

    let query = supabase
      .from("conversations")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    if (lead_id) query = query.eq("kommo_lead_id", String(lead_id));
    if (status) query = query.eq("status", String(status));
    if (since) query = query.gte("last_message_at", String(since));

    const { data, error } = await query;

    if (error) {
      logger.error({ err: error }, "[conversations] DB error");
      throw AppError.internal();
    }

    res.json({ data, count: data?.length ?? 0 });
  } catch (err) {
    next(err);
  }
});

/** GET /api/conversations/:id/messages — message history for a conversation */
conversationRoutes.get("/conversations/:id/messages", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { limit, offset } = parsePagination(req.query as Record<string, unknown>, { limit: 100, maxLimit: 500 });

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error({ err: error }, "[messages] DB error");
      throw AppError.internal();
    }

    res.json({ data: data ?? [], count: data?.length ?? 0 });
  } catch (err) {
    next(err);
  }
});

/** GET /api/leads/:kommoLeadId/status — lead response status */
conversationRoutes.get("/leads/:kommoLeadId/status", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kommoLeadId } = req.params;

    const { data, error } = await supabase
      .from("conversations")
      .select("id, kommo_lead_id, last_message_at, last_incoming_at, last_outgoing_at, status")
      .eq("kommo_lead_id", kommoLeadId);

    if (error) {
      logger.error({ err: error }, "[leads/status] DB error");
      throw AppError.internal();
    }

    if (!data || data.length === 0) {
      throw AppError.notFound("Lead not found");
    }

    const conv = data[0];
    const responded = conv.last_outgoing_at && conv.last_incoming_at
      ? new Date(conv.last_outgoing_at) >= new Date(conv.last_incoming_at)
      : false;

    res.json({ ...conv, responded });
  } catch (err) {
    next(err);
  }
});
