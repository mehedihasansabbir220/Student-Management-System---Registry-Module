import "server-only";
import { PrismaClient, type Prisma } from "@prisma/client";
import { logger } from "./logger";

/**
 * Prisma client singleton.
 * In dev, Next.js hot-reload re-evaluates modules; without caching on globalThis
 * every reload would open a new connection pool and eventually exhaust Postgres.
 */
function createClient() {
  const client = new PrismaClient({
    log: [
      { emit: "event", level: "warn" },
      { emit: "event", level: "error" },
      { emit: "event", level: "query" },
    ],
  });
  client.$on("warn", (e: Prisma.LogEvent) => logger.warn("prisma warning", { prisma: e.message }));
  client.$on("error", (e: Prisma.LogEvent) => logger.error("prisma error", { prisma: e.message }));
  if (process.env.LOG_SQL === "true") {
    client.$on("query", (e: Prisma.QueryEvent) => logger.debug("sql", { query: e.query, durationMs: e.duration }));
  }
  return client;
}

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof createClient> };

export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Tx = Prisma.TransactionClient;
