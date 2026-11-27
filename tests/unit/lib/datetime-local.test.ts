import { describe, expect, it } from "vitest";
import { isoToLocalInput, localInputToIso } from "@/lib/datetime-local";


describe("datetime-local conversion", () => {
  it("turns a wall-clock input into the matching instant and back", () => {
    const iso = localInputToIso("2026-12-01T17:30");
    expect(iso).toBe(new Date(2026, 11, 1, 17, 30).toISOString());
    expect(isoToLocalInput(iso!)).toBe("2026-12-01T17:30");
  });

  it("pads single-digit months, days, hours and minutes", () => {
    expect(isoToLocalInput(new Date(2026, 0, 2, 3, 4).toISOString())).toBe("2026-01-02T03:04");
  });

  it("returns null for an empty or unparsable input", () => {
    expect(localInputToIso("")).toBeNull();
    expect(localInputToIso("not a date")).toBeNull();
  });
});
