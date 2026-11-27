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
});

let cached: { uploadDir: string; maxUploadBytes: number; maxUploadMb: number } | null = null;

export function config() {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration — ${issues}`);
  }
  cached = {
    uploadDir: path.resolve(parsed.data.UPLOAD_DIR),
    maxUploadMb: parsed.data.MAX_UPLOAD_MB,
    maxUploadBytes: Math.floor(parsed.data.MAX_UPLOAD_MB * 1024 * 1024),
  };
  return cached;
}
