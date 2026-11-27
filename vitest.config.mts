import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";
import { loadEnv } from "vite";

const env = loadEnv("test", process.cwd(), "");
// Fixed test-only secret so tests never depend on a developer's .env.
const TEST_JWT_SECRET = "test-secret-test-secret-test-secret-123";
const serverOnlyStub = path.resolve("tests/support/server-only-stub.ts");

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: { alias: { "server-only": serverOnlyStub } },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts", "tests/unit/**/*.test.tsx"],
          environment: "node",
          // Keep test noise out of the real application log.
          env: { LOG_FILE: "", LOG_LEVEL: "error", JWT_SECRET: TEST_JWT_SECRET },
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts"],
          environment: "node",
          // Integration tests share one database → run files sequentially.
          fileParallelism: false,
          globalSetup: ["tests/support/global-setup.ts"],
          setupFiles: ["tests/support/setup-integration.ts"],
          env: {
            DATABASE_URL: env.TEST_DATABASE_URL ?? "",
            UPLOAD_DIR: "./.test-uploads",
            MAX_UPLOAD_MB: "1",
            LOG_LEVEL: "error",
            LOG_FILE: "",
            JWT_SECRET: TEST_JWT_SECRET,
            DEMO_PASSWORD: "Demo@12345",
          },
          testTimeout: 20000,
          hookTimeout: 60000,
        },
      },
      {
        extends: true,
        test: {
          name: "e2e",
          include: ["tests/e2e/**/*.test.ts"],
          environment: "node",
          fileParallelism: false,
          testTimeout: 30000,
        },
      },
    ],
  },
});
