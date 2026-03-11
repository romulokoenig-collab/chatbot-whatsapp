import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  API_KEY: z.string().min(1, "API_KEY is required"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Kommo ChatAPI (Phase A) — optional, Phase B works without these
  KOMMO_CHANNEL_ID: z.string().optional(),
  KOMMO_CHANNEL_SECRET: z.string().optional(),
  KOMMO_SCOPE_ID: z.string().optional(),
  KOMMO_AMOJO_ID: z.string().optional(),

  // WhatsApp Cloud API (Phase A) — optional
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
