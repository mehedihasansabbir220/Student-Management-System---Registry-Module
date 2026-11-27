import { describe, expect, it } from "vitest";
import { resolveTab, studentTabsFor } from "@/lib/student-tabs";

describe("studentTabsFor", () => {
  it("gives finance the money tab but no coursework or results", () => {
    expect(studentTabsFor("FINANCE")).toEqual(["overview", "finance", "activity"]);
  });

  it("gives academics coursework and results but no money", () => {
    expect(studentTabsFor("ACADEMIC")).toEqual(["overview", "coursework", "results", "activity"]);
  });

  it("gives a registry admin every tab", () => {
    expect(studentTabsFor("REGISTRY_ADMIN")).toEqual(["overview", "finance", "coursework", "results", "activity"]);
  });

  it("gives students no staff record tabs", () => {
    expect(studentTabsFor("STUDENT")).toEqual([]);
  });
});

describe("resolveTab", () => {
  it("falls back to overview for a tab the role can't see", () => {
    expect(resolveTab("results", "FINANCE")).toBe("overview");
  });

  it("falls back to overview when no tab is requested", () => {
    expect(resolveTab(undefined, "REGISTRY_ADMIN")).toBe("overview");
  });

  it("falls back to overview for an unknown tab", () => {
    expect(resolveTab("bogus", "REGISTRY_ADMIN")).toBe("overview");
  });

  it("keeps an allowed tab", () => {
    expect(resolveTab("finance", "FINANCE")).toBe("finance");
  });
});
