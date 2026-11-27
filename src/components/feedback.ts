"use client";

import { toast } from "sonner";
import { describeError } from "@/lib/form-errors";

/** Error toast; the description carries the request reference to quote to support. */
export function notifyError(err: unknown): void {
  const { title, description } = describeError(err);
  toast.error(title, { description });
}

export function notifySuccess(message: string): void {
  toast.success(message);
}
