import { describe, expect, it } from "vitest";
import { dashboardKpisFor, dashboardSectionsFor } from "@/lib/dashboard-sections";

describe("dashboardSectionsFor", () => {
  it("shows finance only money work", () => expect(dashboardSectionsFor("FINANCE")).toEqual(["overdue"]));
  it("shows academics coursework first and no money", () => expect(dashboardSectionsFor("ACADEMIC")).toEqual(["deadlines", "late"]));
  it("shows a registry admin every queue, most urgent first", () => {
    expect(dashboardSectionsFor("REGISTRY_ADMIN")).toEqual(["overdue", "awaitingRelease", "deadlines", "late"]);
  });
  it("shows students nothing", () => expect(dashboardSectionsFor("STUDENT")).toEqual([]));
});

describe("dashboardKpisFor", () => {
  it("never shows money KPIs to academics", () => expect(dashboardKpisFor("ACADEMIC")).toEqual(["enrolled", "deadlines"]));
  it("gives finance the money KPIs", () => expect(dashboardKpisFor("FINANCE")).toEqual(["enrolled", "overdue", "outstanding"]));
  it("gives a registry admin every KPI", () => {
    expect(dashboardKpisFor("REGISTRY_ADMIN")).toEqual(["enrolled", "overdue", "awaitingRelease", "outstanding", "deadlines"]);
  });
  it("shows students nothing", () => expect(dashboardKpisFor("STUDENT")).toEqual([]));
});
