import { execSync } from "node:child_process";
import { loadEnv } from "vite";

/**
 * Bring the dedicated test database up to the latest migrations once per run.
 * `migrate deploy` is non-destructive; per-test isolation comes from TRUNCATE
 * in tests/support/factories.ts (resetDatabase).
 */
export default function setup() {
  const env = loadEnv("test", process.cwd(), "");
  const url = env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set — see .env.example");
  if (url === env.DATABASE_URL) throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL (tests wipe it)");
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
}
