import { supabase } from "../config/supabase-client.js";
import type { WebhookSource } from "../types/database-types.js";

/** Strip sensitive headers before logging */
function sanitizeHeaders(headers: Record<string, unknown>): Record<string, unknown> {
  const { authorization, cookie, "set-cookie": setCookie, ...safe } = headers;
  return safe;
}

/** Save raw webhook payload to webhook_raw_log (write-ahead log) */
export async function logRawWebhook(
  source: WebhookSource,
  payload: Record<string, unknown>,
  headers: Record<string, unknown>,
  eventType?: string
): Promise<string> {
  const { data, error } = await supabase
    .from("webhook_raw_log")
    .insert({
      source,
      event_type: eventType ?? null,
      raw_payload: payload,
      headers: sanitizeHeaders(headers),
      processed: false,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[WebhookRawLogger] Failed to log raw webhook:", error.message);
    throw error;
  }

  return data.id;
}

/** Mark a webhook log entry as successfully processed */
export async function markProcessed(id: string): Promise<void> {
  const { error } = await supabase
    .from("webhook_raw_log")
    .update({ processed: true })
    .eq("id", id);

  if (error) {
    console.error("[WebhookRawLogger] Failed to mark processed:", error.message);
  }
}

/** Mark a webhook log entry with an error message */
export async function markError(id: string, errorMessage: string): Promise<void> {
  const { error } = await supabase
    .from("webhook_raw_log")
    .update({ error_message: errorMessage })
    .eq("id", id);

  if (error) {
    console.error("[WebhookRawLogger] Failed to mark error:", error.message);
  }
}
