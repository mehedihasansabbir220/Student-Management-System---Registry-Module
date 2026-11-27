// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import { checkFileBeforeUpload, uploadWithProgress } from "@/lib/upload";

const MiB = 1024 * 1024;

describe("checkFileBeforeUpload", () => {
  it("accepts an upper-case .PDF", () => expect(checkFileBeforeUpload({ name: "ESSAY.PDF", size: 10 }, 10)).toBeNull());
  it("accepts a .docx", () => expect(checkFileBeforeUpload({ name: "essay.docx", size: 10 }, 10)).toBeNull());
  it("rejects an old .doc", () => expect(checkFileBeforeUpload({ name: "essay.doc", size: 10 }, 10)).toBe("Only PDF or DOCX files can be submitted."));
  it("accepts exactly the size limit", () => expect(checkFileBeforeUpload({ name: "a.pdf", size: 10 * MiB }, 10)).toBeNull());
  it("rejects one byte over", () => expect(checkFileBeforeUpload({ name: "a.pdf", size: 10 * MiB + 1 }, 10)).toBe("Files must be 10 MB or smaller."));
  it("rejects an empty file", () => expect(checkFileBeforeUpload({ name: "a.pdf", size: 0 }, 10)).toBe("The file is empty."));
});

/** Minimal scripted XMLHttpRequest: each instance answers with the next queued response. */
type Reply = { status: number; body: unknown };
const replies: Reply[] = [];
const opened: string[] = [];

class FakeXHR {
  status = 0;
  responseText = "";
  upload = { onprogress: null as null | ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) };
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;
  withCredentials = false;
  open(method: string, url: string) {
    opened.push(`${method} ${url}`);
  }
  setRequestHeader() {}
  send() {
    const r = replies.shift()!;
    queueMicrotask(() => {
      this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 });
      this.status = r.status;
      this.responseText = JSON.stringify(r.body);
      this.onload?.();
    });
  }
}

describe("uploadWithProgress", () => {
  const realXHR = globalThis.XMLHttpRequest;
  const realFetch = globalThis.fetch;
  beforeEach(() => {
    replies.length = 0;
    opened.length = 0;
    globalThis.XMLHttpRequest = FakeXHR as unknown as typeof XMLHttpRequest;
  });
  afterEach(() => {
    globalThis.XMLHttpRequest = realXHR;
    globalThis.fetch = realFetch;
  });

  it("reports progress and resolves with the JSON body", async () => {
    replies.push({ status: 201, body: { version: 2, isLate: false } });
    const progress = vi.fn();
    await expect(uploadWithProgress("/api/x", new FormData(), progress)).resolves.toEqual({ version: 2, isLate: false });
    expect(progress).toHaveBeenCalledWith(0.5);
  });

  it("rejects with an ApiClientError carrying the field error", async () => {
    replies.push({ status: 400, body: { error: { code: "VALIDATION_ERROR", message: "Bad file", fields: { file: "This file is not a valid PDF" }, requestId: "r1" } } });
    const err = (await uploadWithProgress("/api/x", new FormData(), () => {}).catch((e: unknown) => e)) as ApiClientError;
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.fields.file).toBe("This file is not a valid PDF");
    expect(err.requestId).toBe("r1");
  });

  it("refreshes an expired session once and retries", async () => {
    replies.push({ status: 401, body: { error: { code: "TOKEN_EXPIRED", message: "expired" } } }, { status: 201, body: { version: 1 } });
    globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 })) as unknown as typeof fetch;
    await expect(uploadWithProgress("/api/x", new FormData(), () => {})).resolves.toEqual({ version: 1 });
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/auth/refresh", { method: "POST" });
    expect(opened).toEqual(["POST /api/x", "POST /api/x"]);
  });
});
