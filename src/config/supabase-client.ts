import { createClient } from "@supabase/supabase-js";
import { env } from "./environment-config.js";

/** Supabase client using service role key — full DB access, no RLS */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
