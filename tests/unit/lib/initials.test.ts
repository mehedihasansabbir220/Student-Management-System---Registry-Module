import { describe, expect, it } from "vitest";
import { initials } from "@/lib/initials";

describe("initials", () => {
  it("uses the first and last name", () => expect(initials("Amelia Rose Clarke")).toBe("AC"));
  it("uses one letter for a single name", () => expect(initials("farid")).toBe("F"));
  it("ignores extra whitespace", () => expect(initials("  oliver   bennett ")).toBe("OB"));
  it("falls back to ? for an empty name", () => expect(initials("   ")).toBe("?"));
});
