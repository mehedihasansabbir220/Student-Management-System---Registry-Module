import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";

/**
 * Minimal structured logger.
 *
 * - One JSON object per line (easy to ship to Datadog / CloudWatch / Loki).
 * - Every line carries the current requestId (via AsyncLocalStorage), so a
 *   single request can be traced across route handler → service → DB error.
 * - Pretty, human-readable output in development.
 * - Optional file sink (LOG_FILE) so server errors are kept on disk locally.
 *
 * Deliberately dependency-free: pino/winston are fine choices in production
 * but have bundling caveats with Next.js; this keeps the assessment portable.
 */

type Level = "debug" | "info" | "warn" | "error";
const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

type Context = { requestId: string; method?: string; path?: string; actor?: string };
const als = new AsyncLocalStorage<Context>();

export function runWithContext<T>(ctx: Context, fn: () => T): T {
  return als.run(ctx, fn);
}

export function getContext(): Context | undefined {
  return als.getStore();
}

const minLevel: number = LEVELS[(process.env.LOG_LEVEL as Level) ?? "info"] ?? LEVELS.info;
const isProd = process.env.NODE_ENV === "production";
const logFile = process.env.LOG_FILE ? path.resolve(process.env.LOG_FILE) : null;
let logDirReady: Promise<unknown> | null = null;

type SerializedError = {
  name?: string;
  message: string;
  code?: unknown;
  meta?: unknown;
  stack?: string;
  cause?: SerializedError;
};

function serializeError(err: unknown): SerializedError {
  if (err instanceof Error) {
    const anyErr = err as Error & { code?: unknown; meta?: unknown; cause?: unknown };
    return {
      name: err.name,
      message: err.message,
      code: anyErr.code,
      meta: anyErr.meta,
      stack: err.stack,
      cause: anyErr.cause ? serializeError(anyErr.cause) : undefined,
    };
  }
  return { message: String(err) };
}

function write(level: Level, msg: string, data?: Record<string, unknown>) {
  if (LEVELS[level] < minLevel) return;

  const ctx = als.getStore();
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(ctx ?? {}),
    ...data,
  };
  if (entry.err) entry.err = serializeError(entry.err);

  const line = JSON.stringify(entry);

  if (isProd) {
    (level === "error" ? process.stderr : process.stdout).write(line + "\n");
  } else {
    const color = { debug: "\x1b[90m", info: "\x1b[36m", warn: "\x1b[33m", error: "\x1b[31m" }[level];
    const rid = ctx?.requestId ? ` [${ctx.requestId.slice(0, 8)}]` : "";
    const rest = { ...data };
    const err = rest.err;
    delete rest.err;
    const extras = Object.keys(rest).length ? " " + JSON.stringify(rest) : "";
    console[level === "debug" ? "log" : level](`${color}${level.toUpperCase()}\x1b[0m${rid} ${msg}${extras}`);
    if (err) console[level === "debug" ? "log" : level](err);
  }

  if (logFile) {
    logDirReady ??= mkdir(path.dirname(logFile), { recursive: true }).catch(() => undefined);
    // Fire-and-forget: logging must never break or slow down a request.
    void logDirReady.then(() => appendFile(logFile, line + "\n")).catch(() => undefined);
  }
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => write("debug", msg, data),
  info: (msg: string, data?: Record<string, unknown>) => write("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => write("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => write("error", msg, data),
};
