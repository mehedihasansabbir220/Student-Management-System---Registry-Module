import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { route } from "@/server/http";

/** Liveness + DB readiness. Unauthenticated; never throws (returns 503 when degraded). */
export const GET = route(async () => {
  const started = performance.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return { status: "ok", database: "up", latencyMs: Math.round(performance.now() - started) };
  } catch (err) {
    logger.error("health check: database unreachable", { err });
    return NextResponse.json({ status: "degraded", database: "down" }, { status: 503 });
  }
});
