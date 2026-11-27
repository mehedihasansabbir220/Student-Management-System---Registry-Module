import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, apiFetch } from "@/lib/api-client";

afterEach(() => vi.unstubAllGlobals());

const respond = (body: unknown, status: number) =>
  vi.stubGlobal("fetch", vi.fn(async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status })));

describe("apiFetch", () => {
  it("returns parsed JSON on success", async () => {
    respond({ id: "1" }, 200);
    await expect(apiFetch("/api/x")).resolves.toEqual({ id: "1" });
  });

  it("sends JSON bodies with the right content type", async () => {
    respond({}, 200);
    await apiFetch("/api/x", { method: "POST", json: { a: 1 } });
    const [, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.headers["content-type"]).toBe("application/json");
    expect(init.body).toBe('{"a":1}');
  });

  it("throws ApiClientError carrying code, field errors and request id", async () => {
    respond({ error: { code: "VALIDATION_ERROR", message: "Some fields are invalid", fields: { email: "Bad" }, requestId: "r-1" } }, 400);
    const err = (await apiFetch("/api/x").catch((e) => e)) as ApiClientError;
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err).toMatchObject({ status: 400, code: "VALIDATION_ERROR", fields: { email: "Bad" }, requestId: "r-1" });
  });

  it("handles non-JSON error pages (e.g. a proxy 502) gracefully", async () => {
    respond("<html>Bad gateway</html>", 502);
    const err = (await apiFetch("/api/x").catch((e) => e)) as ApiClientError;
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.status).toBe(502);
    expect(err.message).toMatch(/unexpected/i);
  });

  it("reports network failures as a friendly error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const err = (await apiFetch("/api/x").catch((e) => e)) as ApiClientError;
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.code).toBe("NETWORK_ERROR");
  });
});
