import { defineConfig, devices } from "@playwright/test";

/**
 * Browser smoke tests against a production build on :3100 (the developer's
 * `next dev` owns .next on :3000, so this uses its own NEXT_DIST_DIR).
 * Uses the seeded demo accounts in the dev database; read-only apart from signing in.
 *   npm run db:seed && npm run test:browser
 */
const PORT = 3100;

export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `NEXT_DIST_DIR=.next-verify npx next build && NEXT_DIST_DIR=.next-verify npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: true,
    timeout: 240_000,
    env: { DEMO_MODE: "true" },
  },
});
