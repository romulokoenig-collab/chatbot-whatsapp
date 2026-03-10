import { supabase } from "../config/supabase-client.js";

/**
 * Get conversations where customer sent a message but no agent reply in N hours.
 * Uses RPC to do proper column-to-column comparison (M4 fix).
 * Fallback: filter client-side if RPC not available.
 */
export async function getUnrespondedLeads(hours: number) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("status", "active")
    .not("last_incoming_at", "is", null)
    .lt("last_incoming_at", cutoff);

  if (error) {
    console.error("[TriggerService] getUnrespondedLeads error:", error.message);
    throw error;
  }

  // Client-side filter: last_outgoing_at is null OR last_outgoing_at < last_incoming_at
  // PostgREST cannot do column-to-column comparison via .or()
  return (data ?? []).filter((row) => {
    if (!row.last_outgoing_at) return true;
    return new Date(row.last_outgoing_at) < new Date(row.last_incoming_at);
  });
}

/**
 * Get conversations where agent replied but customer didn't respond in N hours.
 * Client-side filter for column comparison (M4 fix).
 */
export async function getUnfollowedLeads(hours: number) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("status", "active")
    .not("last_outgoing_at", "is", null)
    .lt("last_outgoing_at", cutoff);

  if (error) {
    console.error("[TriggerService] getUnfollowedLeads error:", error.message);
    throw error;
  }

  // Client-side filter: last_incoming_at is null OR last_incoming_at < last_outgoing_at
  return (data ?? []).filter((row) => {
    if (!row.last_incoming_at) return true;
    return new Date(row.last_incoming_at) < new Date(row.last_outgoing_at);
  });
}
