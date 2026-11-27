import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "vite";

/**
 * Browser tests against a production build on :3100, backed by the TEST
 * database (migrated and re-seeded by global-setup), so flows that write data
 * never touch the dev DB. The developer's `next dev` owns .next on :3000, so
 * this build uses its own NEXT_DIST_DIR.
 *   npx playwright install chromium   (once)
 *   npm run test:browser
 */
const PORT = 3100;
const env = loadEnv("test", process.cwd(), "");

export default defineConfig({
  testDir: "tests/browser",
  globalSetup: "./tests/browser/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `NEXT_DIST_DIR=.next-verify npx next build && NEXT_DIST_DIR=.next-verify npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    // Never reuse a server that might be pointed at another database.
    reuseExistingServer: false,
    timeout: 240_000,
    env: { DATABASE_URL: env.TEST_DATABASE_URL ?? "", DEMO_MODE: "true", UPLOAD_DIR: "./.test-uploads" },
  },
});
