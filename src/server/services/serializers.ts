import "server-only";
import type { Submission } from "@prisma/client";

/** Strip internal storage details before a submission leaves the server. */
export function toPublicSubmission({ storageKey: _storageKey, ...rest }: Submission) {
  return rest;
}
