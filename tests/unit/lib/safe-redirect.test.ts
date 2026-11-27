import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";

describe("safeNextPath", () => {
  it.each(["/staff", "/staff/students?status=ENROLLED", "/me"])("keeps same-site path %s", (p) => {
    expect(safeNextPath(p)).toBe(p);
  });

  it.each([null, undefined, "", "staff", "https://evil.com", "//evil.com", "/\\evil.com", "/staff\n/x", "javascript:alert(1)"])(
    "falls back for unsafe value %j",
    (p) => {
      expect(safeNextPath(p as string | null | undefined)).toBe("/");
    },
  );

  it("uses the given fallback", () => {
    expect(safeNextPath("//x", "/login")).toBe("/login");
  });
});
