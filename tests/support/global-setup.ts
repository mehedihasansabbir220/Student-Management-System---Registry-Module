import { execSync } from "node:child_process";
import { loadEnv } from "vite";

/** Reset the dedicated test database to the latest migrations once per run. */
export default function setup() {
  const env = loadEnv("test", process.cwd(), "");
  const url = env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set — see .env.example");
  if (url === env.DATABASE_URL) throw new Error("TEST_DATABASE_URL must differ from DATABASE_URL (tests wipe it)");
  execSync("npx prisma migrate reset --force --skip-seed --skip-generate", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });
}
