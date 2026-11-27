import { describe, expect, it } from "vitest";
import { activityLabel, describeActivity, visibleActivity } from "@/lib/activity";

const logs = [
  { action: "student.created" },
  { action: "payment.recorded" },
  { action: "fee.added" },
  { action: "grade.entered" },
  { action: "results.withheld" },
  { action: "submission.created" },
];
const actions = (role: Parameters<typeof visibleActivity>[1]) => visibleActivity(logs, role).map((l) => l.action);

describe("visibleActivity", () => {
  it("hides money from academic staff", () => {
    expect(actions("ACADEMIC")).toEqual(["student.created", "grade.entered", "results.withheld", "submission.created"]);
  });

  it("hides marks and submissions from finance", () => {
    expect(actions("FINANCE")).toEqual(["student.created", "payment.recorded", "fee.added"]);
  });

  it("shows everything to a registry admin", () => {
    expect(actions("REGISTRY_ADMIN")).toHaveLength(logs.length);
  });
});

describe("describeActivity", () => {
  it("shows a change as from → to", () => expect(describeActivity({ from: "ENROLLED", to: "DEFERRED" })).toBe("ENROLLED → DEFERRED"));
  it("shows a reason", () => expect(describeActivity({ reason: "Duplicate" })).toBe("Duplicate"));
  it("shows a payment amount and reference", () => expect(describeActivity({ amount: "250.00", reference: "BANK-1" })).toBe("£250.00 · BANK-1"));
  it("shows a mark, including zero", () => expect(describeActivity({ mark: 0 })).toBe("Mark 0"));
  it("lists changed fields", () => expect(describeActivity({ fields: ["email", "fullName"] })).toBe("email, fullName"));
  it("returns null for nothing useful", () => {
    expect(describeActivity(null)).toBeNull();
    expect(describeActivity("x")).toBeNull();
    expect(describeActivity({})).toBeNull();
  });
});

describe("activityLabel", () => {
  it("names known actions", () => expect(activityLabel("payment.voided")).toBe("Payment voided"));
  it("falls back to the raw action", () => expect(activityLabel("something.new")).toBe("something.new"));
});
