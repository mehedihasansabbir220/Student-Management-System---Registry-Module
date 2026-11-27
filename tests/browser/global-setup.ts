import { execSync } from "node:child_process";
import { loadEnv } from "vite";

/**
 * Browser tests write data (enrol, pay, upload…), so they run against the
 * TEST database, freshly migrated and seeded, never the developer's dev DB.
 */
export default function globalSetup() {
  const env = loadEnv("test", process.cwd(), "");
  const url = env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set — see .env.example");
  if (url === env.DATABASE_URL) throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL");
  const run = (cmd: string) => execSync(cmd, { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
  run("npx prisma migrate deploy");
  run("npx prisma db seed");
}
