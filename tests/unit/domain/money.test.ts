import { describe, expect, it } from "vitest";
import { formatGBP, fromPence, toPence } from "@/domain/money";

describe("toPence", () => {
  it("converts decimal strings exactly, without float drift", () => {
    expect(toPence("0.10")).toBe(10);
    expect(toPence("0.20")).toBe(20);
    expect(toPence("9250.00")).toBe(925000);
    expect(toPence("1234.5")).toBe(123450);
    expect(toPence("19.99")).toBe(1999);
  });

  it("accepts numbers and objects with toString (Prisma.Decimal)", () => {
    expect(toPence(12.34)).toBe(1234);
    expect(toPence({ toString: () => "8500.00" })).toBe(850000);
  });

  it("rejects more than two decimal places instead of silently rounding", () => {
    expect(() => toPence("10.999")).toThrow();
  });

  it("rejects non-numeric input", () => {
    expect(() => toPence("abc")).toThrow();
  });
});

describe("fromPence", () => {
  it("produces a 2dp decimal string suitable for Prisma", () => {
    expect(fromPence(925000)).toBe("9250.00");
    expect(fromPence(5)).toBe("0.05");
    expect(fromPence(-150)).toBe("-1.50");
  });
});

describe("formatGBP", () => {
  it("formats pence as pounds with separators", () => {
    expect(formatGBP(125000)).toBe("£1,250.00");
    expect(formatGBP(0)).toBe("£0.00");
  });
});
