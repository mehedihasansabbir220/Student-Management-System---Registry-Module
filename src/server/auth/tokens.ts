import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** 256 bits of randomness, URL-safe. Used for refresh and activation tokens. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Only the SHA-256 of a token is stored. A database leak therefore exposes no
 * usable tokens. (A plain fast hash is fine here — unlike passwords, these
 * tokens are high-entropy, so brute-forcing the hash is infeasible.)
 */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
