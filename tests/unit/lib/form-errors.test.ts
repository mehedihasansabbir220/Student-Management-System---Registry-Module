import { describe, expect, it } from "vitest";
import { ApiClientError } from "@/lib/api-client";
import { describeError } from "@/lib/form-errors";

const GENERIC = "Something went wrong. Please try again.";
const OFFLINE = "Can't reach the server. Check your connection and try again.";

describe("describeError", () => {
  it("passes through the API message, field errors and request reference", () => {
    const err = new ApiClientError("Please check the highlighted fields", 400, "VALIDATION_ERROR", { email: "Already enrolled" }, "req_1");
    expect(describeError(err)).toEqual({
      title: "Please check the highlighted fields",
      description: "Reference: req_1",
      fields: { email: "Already enrolled" },
    });
  });

  it("omits the description when the API gave no request id", () => {
    const err = new ApiClientError("Not found", 404, "NOT_FOUND");
    expect(describeError(err).description).toBeUndefined();
  });

  it("keeps the server's wording for rate limits and lockouts", () => {
    const err = new ApiClientError("Too many failed attempts. Try again in 15 minutes.", 429, "TOO_MANY_REQUESTS");
    expect(describeError(err).title).toBe("Too many failed attempts. Try again in 15 minutes.");
  });

  it("explains a network failure from apiFetch", () => {
    const err = new ApiClientError("Could not reach the server.", 0, "NETWORK_ERROR");
    expect(describeError(err)).toEqual({ title: OFFLINE, fields: {} });
  });

  it("explains a raw fetch TypeError the same way", () => {
    expect(describeError(new TypeError("Failed to fetch"))).toEqual({ title: OFFLINE, fields: {} });
  });

  it.each([["boom"], [undefined], [new Error("x")], [null]])("falls back to a generic message for %s", (value) => {
    expect(describeError(value)).toEqual({ title: GENERIC, fields: {} });
  });
});
