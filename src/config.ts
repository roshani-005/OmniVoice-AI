import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const configSchema = z.object({
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  
  // Real-time Voice & AI settings
  DEFAULT_VOICE_MODEL: z.string().default("gemini-2.5-flash"),
  SIMULATED_STT_LATENCY_MS: z.coerce.number().default(180),
  SIMULATED_TTFT_LATENCY_MS: z.coerce.number().default(240),
  SIMULATED_TTS_LATENCY_MS: z.coerce.number().default(190),

  // Business limits & thresholds
  MAX_ALLOWED_ROUNDTRIP_LATENCY_MS: z.coerce.number().default(1200), // SLA Alert threshold
  MAX_ALLOWED_DISCOUNT_PERCENT: z.coerce.number().default(15),

  // API credentials (Optional: local simulation runs seamlessly if missing)
  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  DEEPGRAM_API_KEY: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  WHATSAPP_API_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
});

export type Config = z.infer<typeof configSchema>;
export const config: Config = configSchema.parse(process.env);
