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

describe("apiFetch session refresh", () => {
  const expired = () => new Response(JSON.stringify({ error: { code: "TOKEN_EXPIRED", message: "Your session has expired", requestId: "r" } }), { status: 401 });
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  /** Routes stubbed fetch calls by URL so concurrency is easy to reason about. */
  function stubFetch(handlers: { refresh: () => Response; api: () => Response }) {
    const fn = vi.fn(async (url: string) => (url === "/api/auth/refresh" ? handlers.refresh() : handlers.api()));
    vi.stubGlobal("fetch", fn);
    return fn;
  }

  it("refreshes once and retries when the access token has expired", async () => {
    let calls = 0;
    const fn = stubFetch({ refresh: () => ok({ user: {} }), api: () => (calls++ === 0 ? expired() : ok({ saved: true })) });
    await expect(apiFetch("/api/x", { method: "POST", json: { a: 1 } })).resolves.toEqual({ saved: true });
    expect(fn.mock.calls.map((c) => c[0])).toEqual(["/api/x", "/api/auth/refresh", "/api/x"]);
  });

  it("shares one refresh between concurrent requests", async () => {
    const seen = new Set<string>();
    const fn = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/auth/refresh") return ok({});
      const key = `${url}:${String(init?.body)}`;
      if (seen.has(key)) return ok({ url });
      seen.add(key);
      return expired();
    });
    vi.stubGlobal("fetch", fn);
    await Promise.all([apiFetch("/api/a"), apiFetch("/api/b")]);
    expect(fn.mock.calls.filter((c) => c[0] === "/api/auth/refresh")).toHaveLength(1);
  });

  it("sends the user to login (with a return path) when refresh fails", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { pathname: "/staff", search: "?tab=fees", assign });
    stubFetch({ refresh: () => new Response(JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "x", requestId: "r" } }), { status: 401 }), api: expired });
    const err = (await apiFetch("/api/x").catch((e) => e)) as ApiClientError;
    expect(err.code).toBe("SESSION_EXPIRED");
    expect(assign).toHaveBeenCalledWith("/login?next=%2Fstaff%3Ftab%3Dfees");
  });

  it("does not try to refresh on other 401s", async () => {
    const fn = stubFetch({ refresh: () => ok({}), api: () => new Response(JSON.stringify({ error: { code: "UNAUTHENTICATED", message: "x", requestId: "r" } }), { status: 401 }) });
    await apiFetch("/api/x").catch(() => undefined);
    expect(fn.mock.calls.map((c) => c[0])).toEqual(["/api/x"]);
  });
});
