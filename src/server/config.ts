import "server-only";
import path from "node:path";
import { z } from "zod";

/**
 * Environment is validated once, on first use. A misconfigured deployment
 * fails loudly with a clear message instead of misbehaving later.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  UPLOAD_DIR: z.string().default("./uploads"),
  MAX_UPLOAD_MB: z.coerce.number().positive().max(100).default(10),
  JWT_SECRET: z.string({ error: "JWT_SECRET is required" }).min(32, "JWT_SECRET must be at least 32 characters"),
  // Only the exact string "true" enables demo mode — a typo never silently turns it on.
  DEMO_MODE: z.string().optional().transform((v) => v === "true"),
  DEMO_PASSWORD: z.string().min(8).default("Demo@12345"),
});

type Config = {
  uploadDir: string;
  maxUploadBytes: number;
  maxUploadMb: number;
  demoMode: boolean;
  demoPassword: string;
};

let cached: Config | null = null;

export function config(): Config {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    // Name the variable and the rule — never echo the (possibly secret) value.
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration — ${issues}`);
  }
  cached = {
    uploadDir: path.resolve(parsed.data.UPLOAD_DIR),
    maxUploadMb: parsed.data.MAX_UPLOAD_MB,
    maxUploadBytes: Math.floor(parsed.data.MAX_UPLOAD_MB * 1024 * 1024),
    demoMode: parsed.data.DEMO_MODE,
    demoPassword: parsed.data.DEMO_PASSWORD,
  };
  return cached;
}
