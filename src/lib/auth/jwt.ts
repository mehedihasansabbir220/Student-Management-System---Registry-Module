/**
 * Access tokens (JWT, HS256). Edge-safe — no `server-only`, no `node:` imports —
 * because middleware verifies them on every page navigation.
 *
 * Access tokens are short-lived (15 min) and stateless; the long-lived,
 * revocable part of a session is the refresh token (src/server/services/auth.ts).
 */
import { SignJWT, errors, jwtVerify } from "jose";
import { ROLES, type Role } from "@/domain/permissions";

export const ACCESS_TTL_SECONDS = 900;
const ISSUER = "sms-registry";
const AUDIENCE = "sms-web";
const MIN_SECRET_LENGTH = 32;

export type AccessClaims = {
  /** User id */
  sub: string;
  role: Role;
  /** Refresh-token family id — identifies this login session */
  sid: string;
  studentId?: string;
  demo?: boolean;
};

export class TokenError extends Error {
  constructor(public readonly reason: "expired" | "invalid", options?: { cause?: unknown }) {
    super(reason === "expired" ? "Access token expired" : "Access token invalid", options);
    this.name = "TokenError";
  }
}

export function jwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? "";
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }
  return new TextEncoder().encode(secret);
}

const seconds = (d: Date) => Math.floor(d.getTime() / 1000);

export async function signAccessToken(claims: AccessClaims, now = new Date()): Promise<string> {
  const payload: Record<string, unknown> = { role: claims.role, sid: claims.sid };
  if (claims.studentId) payload.studentId = claims.studentId;
  if (claims.demo) payload.demo = true;
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(seconds(now))
    .setExpirationTime(seconds(now) + ACCESS_TTL_SECONDS)
    .sign(jwtSecret());
}

export async function verifyAccessToken(token: string, now = new Date()): Promise<AccessClaims> {
  let payload;
  try {
    // `algorithms` pins HS256: alg:none and algorithm-confusion tokens are rejected.
    ({ payload } = await jwtVerify(token, jwtSecret(), { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"], currentDate: now }));
  } catch (err) {
    throw new TokenError(err instanceof errors.JWTExpired ? "expired" : "invalid", { cause: err });
  }
  const { sub, role, sid, studentId, demo } = payload as Record<string, unknown>;
  if (typeof sub !== "string" || typeof sid !== "string" || !ROLES.includes(role as Role)) throw new TokenError("invalid");
  if (studentId !== undefined && typeof studentId !== "string") throw new TokenError("invalid");
  return { sub, role: role as Role, sid, ...(studentId ? { studentId: studentId as string } : {}), ...(demo === true ? { demo: true } : {}) };
}
