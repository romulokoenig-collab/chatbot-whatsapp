import { Router } from "express";
import type { Request, Response } from "express";
import { supabase } from "../config/supabase-client.js";

export const conversationRoutes = Router();

/** GET /api/conversations — list conversations with filters */
conversationRoutes.get("/conversations", async (req: Request, res: Response) => {
  try {
    const { lead_id, status, since, limit = "50", offset = "0" } = req.query;

    let query = supabase
      .from("conversations")
      .select("*")
      .order("last_message_at", { ascending: false })
      .limit(Number(limit))
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (lead_id) query = query.eq("kommo_lead_id", String(lead_id));
    if (status) query = query.eq("status", String(status));
    if (since) query = query.gte("last_message_at", String(since));

    const { data, error } = await query;

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ data, count: data?.length ?? 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

/** GET /api/conversations/:id/messages — message history for a conversation */
conversationRoutes.get("/conversations/:id/messages", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { limit = "100", offset = "0" } = req.query;

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(Number(limit))
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ data, count: data?.length ?? 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

/** GET /api/leads/:kommoLeadId/status — lead response status */
conversationRoutes.get("/leads/:kommoLeadId/status", async (req: Request, res: Response) => {
  try {
    const { kommoLeadId } = req.params;

    const { data, error } = await supabase
      .from("conversations")
      .select("id, kommo_lead_id, last_message_at, last_incoming_at, last_outgoing_at, status")
      .eq("kommo_lead_id", kommoLeadId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (!data || data.length === 0) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }

    // A lead is "responded" if last_outgoing_at >= last_incoming_at
    const conv = data[0];
    const responded = conv.last_outgoing_at && conv.last_incoming_at
      ? new Date(conv.last_outgoing_at) >= new Date(conv.last_incoming_at)
      : false;

    res.json({ ...conv, responded });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
