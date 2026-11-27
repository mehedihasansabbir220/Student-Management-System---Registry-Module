import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError, type ZodType } from "zod";
import { AppError, ForbiddenError, ValidationError, type ErrorCode, type FieldErrors } from "./errors";
import { logger, runWithContext } from "./logger";

/** The single error shape every API route returns. Mirrored in src/lib/api-client.ts. */
export type ApiErrorBody = {
  error: { code: ErrorCode; message: string; fields?: FieldErrors; requestId: string };
};

type RouteContext<P> = { params: Promise<P> };
type Handler<P> = (req: NextRequest, ctx: { params: P }) => Promise<Response | unknown>;

/**
 * Wraps a route handler with:
 *  - request id (honours inbound x-request-id, else generates one) on every log line + response header
 *  - access log with status + latency
 *  - uniform error mapping (AppError, Zod, Prisma, unknown → 500)
 * Handlers can return a Response or a plain object (serialised as 200 JSON).
 */
export function route<P = Record<string, never>>(handler: Handler<P>) {
  return async (req: NextRequest, ctx: RouteContext<P>): Promise<Response> => {
    const requestId = req.headers.get("x-request-id") ?? randomUUID();
    const started = performance.now();
    const pathname = req.nextUrl.pathname;

    return runWithContext({ requestId, method: req.method, path: pathname }, async () => {
      let response: Response;
      try {
        assertSameOrigin(req);
        const params = await ctx.params;
        const result = await handler(req, { params });
        response = result instanceof Response ? result : NextResponse.json(result ?? { ok: true });
      } catch (err) {
        response = toErrorResponse(err, requestId);
      }
      response.headers.set("x-request-id", requestId);
      const durationMs = Math.round(performance.now() - started);
      const level = response.status >= 500 ? "error" : response.status >= 400 ? "warn" : "info";
      logger[level]("request completed", { status: response.status, durationMs });
      return response;
    });
  };
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defence (alongside SameSite cookies): browsers always send Origin on
 * cross-site state-changing requests, so a foreign Origin is refused. Requests
 * with no Origin (curl, server-to-server) carry no ambient browser cookies risk.
 */
function assertSameOrigin(req: NextRequest) {
  if (SAFE_METHODS.has(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ForbiddenError("Cross-site request blocked");
  }
  if (originHost !== host) throw new ForbiddenError("Cross-site request blocked");
}

export function toErrorResponse(err: unknown, requestId: string): Response {
  const mapped = mapError(err);
  if (mapped.status >= 500) {
    // Full detail (stack, Prisma meta) goes to logs only — never to the client.
    logger.error("unhandled error", { err });
  } else {
    logger.debug("handled error", { code: mapped.code, message: mapped.message, fields: mapped.fields });
  }
  const body: ApiErrorBody = {
    error: { code: mapped.code, message: mapped.message, fields: mapped.fields, requestId },
  };
  return NextResponse.json(body, { status: mapped.status });
}

type Mapped = { status: number; code: ErrorCode; message: string; fields?: FieldErrors };

const UNIQUE_MESSAGES: Record<string, { field: string; message: string }> = {
  email: { field: "email", message: "A student with this email already exists" },
  reference: { field: "reference", message: "A payment with this reference has already been recorded" },
  code: { field: "code", message: "This code is already in use" },
};

export function mapError(err: unknown): Mapped {
  if (err instanceof AppError) {
    return { status: err.status, code: err.code, message: err.message, fields: err.fields };
  }

  if (err instanceof ZodError) {
    return { status: 400, code: "VALIDATION_ERROR", message: "Some fields are invalid", fields: zodToFields(err) };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": {
        const target = ([] as string[]).concat((err.meta?.target as string[] | string) ?? []);
        const known = target.map((t) => UNIQUE_MESSAGES[t]).find(Boolean);
        return {
          status: 409,
          code: "CONFLICT",
          message: known?.message ?? "This record already exists",
          fields: known ? { [known.field]: known.message } : undefined,
        };
      }
      case "P2025":
        return { status: 404, code: "NOT_FOUND", message: "Record not found" };
      case "P2003":
        return { status: 409, code: "CONFLICT", message: "A related record is missing or still in use" };
      case "P2034":
        return { status: 409, code: "CONFLICT", message: "Another change happened at the same time — please retry" };
      case "P1001":
      case "P1002":
        return { status: 503, code: "SERVICE_UNAVAILABLE", message: "The database is unavailable. Please try again shortly." };
    }
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    return { status: 503, code: "SERVICE_UNAVAILABLE", message: "The database is unavailable. Please try again shortly." };
  }

  // CHECK constraint violations surface as unknown request errors.
  if (err instanceof Prisma.PrismaClientUnknownRequestError && /violates check constraint/i.test(err.message)) {
    return { status: 422, code: "BUSINESS_RULE", message: "The value breaks a data rule and was not saved" };
  }

  return { status: 500, code: "INTERNAL_ERROR", message: "Something went wrong on our side. The error has been logged." };
}

export function zodToFields(err: ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of err.issues) {
    const key = issue.path.join(".") || "_";
    fields[key] ??= issue.message;
  }
  return fields;
}

/** Parse + validate a JSON body. Malformed JSON → 400 rather than a 500. */
export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }
  return schema.parse(raw);
}

export function parseQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams));
}

export function created(body: unknown) {
  return NextResponse.json(body, { status: 201 });
}
