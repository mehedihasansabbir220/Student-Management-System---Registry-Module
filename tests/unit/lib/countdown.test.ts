import { describe, expect, it } from "vitest";
import { countdown } from "@/lib/countdown";

const now = new Date("2026-03-10T12:00:00Z");
const after = (ms: number) => new Date(now.getTime() + ms);
const H = 3_600_000;

describe("countdown", () => {
  it("counts whole days when far away", () => expect(countdown(after(3 * 24 * H), now)).toEqual({ label: "Due in 3 days", urgent: false }));
  it("is urgent under 48 hours and counts hours", () => expect(countdown(after(47 * H), now)).toEqual({ label: "Due in 47 hours", urgent: true }));
  it("uses the singular for one hour", () => expect(countdown(after(H), now)).toEqual({ label: "Due in 1 hour", urgent: true }));
  it("counts minutes in the last hour", () => expect(countdown(after(12 * 60_000), now)).toEqual({ label: "Due in 12 minutes", urgent: true }));
  it("says at least 1 minute right before the deadline", () => expect(countdown(after(20_000), now).label).toBe("Due in 1 minute"));
  it("reports a passed deadline as not urgent", () => expect(countdown(after(-1000), now)).toEqual({ label: "Deadline passed", urgent: false }));
  it("is not urgent at exactly 48 hours", () => expect(countdown(after(48 * H), now)).toEqual({ label: "Due in 2 days", urgent: false }));
});
