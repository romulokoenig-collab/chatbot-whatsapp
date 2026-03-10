import { supabase } from "../config/supabase-client.js";

/**
 * Get conversations where customer sent a message but no agent reply in N hours.
 * Logic: last_incoming_at > last_outgoing_at AND last_incoming_at < NOW() - hours
 */
export async function getUnrespondedLeads(hours: number) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("status", "active")
    .not("last_incoming_at", "is", null)
    .lt("last_incoming_at", cutoff)
    .or("last_outgoing_at.is.null,last_outgoing_at.lt.last_incoming_at");

  if (error) {
    console.error("[TriggerService] getUnrespondedLeads error:", error.message);
    throw error;
  }

  return data ?? [];
}

/**
 * Get conversations where agent replied but customer didn't respond in N hours.
 * Logic: last_outgoing_at > last_incoming_at AND last_outgoing_at < NOW() - hours
 */
export async function getUnfollowedLeads(hours: number) {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("status", "active")
    .not("last_outgoing_at", "is", null)
    .lt("last_outgoing_at", cutoff)
    .or("last_incoming_at.is.null,last_incoming_at.lt.last_outgoing_at");

  if (error) {
    console.error("[TriggerService] getUnfollowedLeads error:", error.message);
    throw error;
  }

  return data ?? [];
}
