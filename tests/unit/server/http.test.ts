import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { NextRequest } from "next/server";
import { mapError, route } from "@/server/http";
import { BusinessRuleError, NotFoundError } from "@/server/errors";

const prismaKnown = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError("boom", { code, clientVersion: "test", meta });

describe("mapError", () => {
  it("passes AppError status, code and field errors through", () => {
    const m = mapError(new BusinessRuleError("Deadline has passed", { file: "Too late" }));
    expect(m).toEqual({ status: 422, code: "BUSINESS_RULE", message: "Deadline has passed", fields: { file: "Too late" } });
  });

  it("turns a ZodError into 400 with per-field messages", () => {
    const err = z.object({ email: z.string().email("Enter a valid email") }).safeParse({ email: "x" }).error!;
    const m = mapError(err);
    expect(m.status).toBe(400);
    expect(m.code).toBe("VALIDATION_ERROR");
    expect(m.fields).toEqual({ email: "Enter a valid email" });
  });

  it("maps a duplicate email (P2002) to a friendly 409 on the email field", () => {
    const m = mapError(prismaKnown("P2002", { target: ["email"] }));
    expect(m.status).toBe(409);
    expect(m.fields).toEqual({ email: "A student with this email already exists" });
  });

  it("maps a duplicate payment reference to 409 on the reference field", () => {
    const m = mapError(prismaKnown("P2002", { target: ["reference"] }));
    expect(m.fields?.reference).toMatch(/already been recorded/);
  });

  it("maps record-not-found (P2025) to 404", () => {
    expect(mapError(prismaKnown("P2025")).status).toBe(404);
  });

  it("maps database-unreachable errors to 503 so clients know to retry", () => {
    expect(mapError(prismaKnown("P1001")).status).toBe(503);
    expect(mapError(new Prisma.PrismaClientInitializationError("down", "test")).status).toBe(503);
  });

  it("maps CHECK constraint violations to 422", () => {
    const err = new Prisma.PrismaClientUnknownRequestError('new row violates check constraint "Grade_mark_range"', {
      clientVersion: "test",
    });
    expect(mapError(err).status).toBe(422);
  });

  it("hides the details of unexpected errors behind a generic 500", () => {
    const m = mapError(new Error("connection string postgres://secret@db leaked"));
    expect(m.status).toBe(500);
    expect(m.message).not.toMatch(/secret/);
  });
});

describe("route wrapper", () => {
  const req = (headers?: Record<string, string>) => new NextRequest("http://localhost/api/x", { headers });
  const ctx = { params: Promise.resolve({}) };

  it("serialises a plain return value as 200 JSON with a request id header", async () => {
    const res = await route(async () => ({ hello: "world" }))(req(), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ hello: "world" });
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("returns the standard error body and echoes an inbound request id", async () => {
    const res = await route(async () => {
      throw new NotFoundError("Student");
    })(req({ "x-request-id": "abc-123" }), ctx);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Student not found", requestId: "abc-123" },
    });
    expect(res.headers.get("x-request-id")).toBe("abc-123");
  });

  describe("cross-site request protection", () => {
    const send = (method: string, origin?: string) => {
      const headers: Record<string, string> = { host: "localhost:3000" };
      if (origin) headers.origin = origin;
      return route(async () => ({ ok: true }))(new NextRequest("http://localhost:3000/api/x", { method, headers }), ctx);
    };

    it("blocks a state-changing request from another site", async () => {
      const res = await send("POST", "https://evil.test");
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("FORBIDDEN");
    });

    it("allows the same site, and requests without an Origin header (non-browser clients)", async () => {
      expect((await send("POST", "http://localhost:3000")).status).toBe(200);
      expect((await send("PATCH")).status).toBe(200);
    });

    it("does not block safe methods", async () => {
      expect((await send("GET", "https://evil.test")).status).toBe(200);
    });
  });

  it("never lets an unexpected throw escape as an unhandled rejection", async () => {
    const res = await route(async () => {
      throw new TypeError("cannot read properties of undefined");
    })(req(), ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.requestId).toBeTruthy();
  });
});
