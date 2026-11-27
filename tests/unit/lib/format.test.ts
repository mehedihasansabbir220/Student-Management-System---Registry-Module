import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, relativeToNow, toDateInput } from "@/lib/format";

describe("formatDate", () => {
  it("formats in UK style regardless of server timezone", () => {
    expect(formatDate(new Date("2026-03-05T00:00:00Z"))).toBe("5 Mar 2026");
  });

  it("accepts ISO strings (as received from JSON APIs)", () => {
    expect(formatDate("2026-12-25T00:00:00.000Z")).toBe("25 Dec 2026");
  });

  it("renders a dash for missing values", () => {
    expect(formatDate(null)).toBe("—");
  });
});

describe("formatDateTime", () => {
  it("shows UK local time (BST in summer) with the zone", () => {
    expect(formatDateTime(new Date("2026-07-01T16:00:00Z"))).toBe("1 Jul 2026, 17:00 BST");
    expect(formatDateTime(new Date("2026-01-15T16:00:00Z"))).toBe("15 Jan 2026, 16:00 GMT");
  });
});

describe("relativeToNow", () => {
  const now = new Date("2026-03-15T12:00:00Z");
  it.each([
    ["2026-03-15T13:30:00Z", "in 1 hour"],
    ["2026-03-17T12:00:00Z", "in 2 days"],
    ["2026-03-15T11:00:00Z", "1 hour ago"],
    ["2026-03-05T12:00:00Z", "10 days ago"],
    ["2026-03-15T12:00:30Z", "in less than a minute"],
  ])("%s → %s", (iso, expected) => {
    expect(relativeToNow(new Date(iso), now)).toBe(expected);
  });
});

describe("toDateInput", () => {
  it("produces YYYY-MM-DD for <input type=date>", () => {
    expect(toDateInput(new Date("2004-05-10T00:00:00Z"))).toBe("2004-05-10");
  });
});
