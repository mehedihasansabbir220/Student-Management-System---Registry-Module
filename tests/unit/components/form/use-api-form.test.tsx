// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createStudentSchema, recordPaymentSchema } from "@/lib/validation";
import { ApiClientError } from "@/lib/api-client";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const { useApiForm } = await import("@/components/form/use-api-form");

const student = { fullName: "Ada Lovelace", email: "ada@example.com", dateOfBirth: "2004-01-01", academicYear: "2025/26", programmeId: "prog_1", status: "ENROLLED" as const };

async function submit(hook: { current: { onSubmit: () => Promise<void> } }) {
  await act(async () => {
    await hook.current.onSubmit();
  });
}

describe("useApiForm", () => {
  it("sends what the user typed, not the parsed values, so the API can parse it again", async () => {
    const sent = vi.fn().mockResolvedValue({});
    const { result } = renderHook(() => useApiForm(createStudentSchema, sent, { defaultValues: student }));
    await submit(result);
    expect(sent).toHaveBeenCalledTimes(1);
    const body = sent.mock.calls[0][0];
    expect(body.dateOfBirth).toBe("2004-01-01");
    // The request body must pass the server's schema after a JSON round trip.
    expect(createStudentSchema.safeParse(JSON.parse(JSON.stringify(body))).success).toBe(true);
  });

  it("keeps money as the typed pounds string", async () => {
    const sent = vi.fn().mockResolvedValue({});
    const { result } = renderHook(() =>
      useApiForm(recordPaymentSchema, sent, { defaultValues: { amount: "12.50", paidOn: "2026-01-02", reference: "ref-1", method: "CARD" } }),
    );
    await submit(result);
    expect(sent.mock.calls[0][0]).toMatchObject({ amount: "12.50", paidOn: "2026-01-02" });
  });

  it("does not call the API when client-side validation fails", async () => {
    const sent = vi.fn();
    const { result } = renderHook(() => useApiForm(createStudentSchema, sent, { defaultValues: { ...student, dateOfBirth: "not-a-date" } }));
    await submit(result);
    expect(sent).not.toHaveBeenCalled();
    expect(result.current.form.formState.errors.dateOfBirth).toBeDefined();
  });

  it("puts server field errors on their inputs without a toast", async () => {
    const sent = vi.fn().mockRejectedValue(new ApiClientError("Check the fields", 400, "VALIDATION_ERROR", { email: "Already enrolled" }, "req_9"));
    toast.error.mockClear();
    const { result } = renderHook(() => useApiForm(createStudentSchema, sent, { defaultValues: student }));
    await submit(result);
    expect(result.current.form.formState.errors.email?.message).toBe("Already enrolled");
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("toasts with the request reference when the error has no matching field", async () => {
    const sent = vi.fn().mockRejectedValue(new ApiClientError("Programme not found", 404, "NOT_FOUND", {}, "req_7"));
    toast.error.mockClear();
    const { result } = renderHook(() => useApiForm(createStudentSchema, sent, { defaultValues: student }));
    await submit(result);
    expect(toast.error).toHaveBeenCalledWith("Programme not found", { description: "Reference: req_7" });
    // The user's input is kept.
    expect(result.current.form.getValues("fullName")).toBe("Ada Lovelace");
  });
});
