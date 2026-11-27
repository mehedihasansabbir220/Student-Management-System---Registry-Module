import "server-only";
import { randomUUID } from "node:crypto";
import type { User } from "@prisma/client";
import { db, type Tx } from "../db";
import { audit } from "../audit";
import { BusinessRuleError, NotFoundError, RateLimitedError, UnauthenticatedError, ValidationError } from "../errors";
import { logger } from "../logger";
import { hashPassword, verifyPassword } from "../auth/password";
import { generateOpaqueToken, hashToken } from "../auth/tokens";
import { signAccessToken } from "@/lib/auth/jwt";

/**
 * Authentication: login, refresh-token rotation, logout and sessions.
 *
 * Model (design §5.1): a short-lived stateless JWT access token plus a
 * long-lived opaque refresh token stored hashed in the DB. Each login starts a
 * token *family*; every refresh revokes the presented token and issues its
 * successor in the same family. Presenting an already-rotated token means it
 * was copied — the whole family is revoked (stolen-token defence), except
 * within a short grace window that absorbs two tabs refreshing at once.
 */

export const REFRESH_TTL_MS = 7 * 86_400_000;
export const LOCKOUT_THRESHOLD = 5;
export const LOCKOUT_MS = 15 * 60_000;
export const REFRESH_REUSE_GRACE_MS = 10_000;
export const ACTIVATION_TTL_MS = 72 * 3_600_000;

const GENERIC_LOGIN_ERROR = "Email or password is incorrect";
const LOCKED_MESSAGE = "Too many failed attempts. Try again in 15 minutes.";

export type AuthMeta = { ip?: string; userAgent?: string; now?: Date };
export type PublicUser = { id: string; email: string; name: string; role: User["role"]; studentId: string | null; isDemo: boolean };
export type IssuedSession = { accessToken: string; refreshToken: string; user: PublicUser };

export function toPublicUser(u: User): PublicUser {
  return { id: u.id, email: u.email, name: u.name, role: u.role, studentId: u.studentId, isDemo: u.isDemo };
}

// Verifying against a dummy hash for unknown emails keeps response time the
// same whether or not the account exists (no user enumeration by timing).
let dummyHash: Promise<string> | null = null;
const getDummyHash = () => (dummyHash ??= hashPassword("dummy-password-for-timing"));

async function issue(user: User, familyId: string, meta: AuthMeta, now: Date) {
  const refreshToken = generateOpaqueToken();
  const row = await db.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      familyId,
      expiresAt: new Date(now.getTime() + REFRESH_TTL_MS),
      ip: meta.ip?.slice(0, 64),
      userAgent: meta.userAgent?.slice(0, 300),
    },
  });
  const accessToken = await signAccessToken(
    { sub: user.id, role: user.role, sid: familyId, studentId: user.studentId ?? undefined, demo: user.isDemo || undefined },
    now,
  );
  return { row, session: { accessToken, refreshToken, user: toPublicUser(user) } };
}

export async function login(input: { email: string; password: string }, meta: AuthMeta): Promise<IssuedSession> {
  const now = meta.now ?? new Date();
  const email = input.email.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash) {
    await verifyPassword(input.password, await getDummyHash());
    throw new UnauthenticatedError(GENERIC_LOGIN_ERROR);
  }
  if (!user.isDemo && user.lockedUntil && user.lockedUntil > now) {
    throw new RateLimitedError(LOCKED_MESSAGE, Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 1000));
  }

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok || !user.isActive) {
    if (!ok && !user.isDemo) await recordFailure(user.id, now);
    throw new UnauthenticatedError(GENERIC_LOGIN_ERROR);
  }

  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: now } });
  const { session } = await issue(user, randomUUID(), meta, now);
  logger.info("user signed in", { userId: user.id, role: user.role });
  return session;
}

async function recordFailure(userId: string, now: Date) {
  // Atomic increment — concurrent wrong guesses can't slip past the threshold.
  const { failedLoginCount } = await db.user.update({ where: { id: userId }, data: { failedLoginCount: { increment: 1 } } });
  if (failedLoginCount >= LOCKOUT_THRESHOLD) {
    await db.user.update({ where: { id: userId }, data: { failedLoginCount: 0, lockedUntil: new Date(now.getTime() + LOCKOUT_MS) } });
    logger.warn("account locked after repeated failed logins", { userId });
  }
}

export async function refresh(rawRefreshToken: string, meta: AuthMeta): Promise<IssuedSession> {
  const now = meta.now ?? new Date();
  const row = await db.refreshToken.findUnique({ where: { tokenHash: hashToken(rawRefreshToken) }, include: { user: true } });
  if (!row) throw new UnauthenticatedError();

  if (row.revokedAt) {
    const withinGrace = row.replacedById !== null && now.getTime() - row.revokedAt.getTime() <= REFRESH_REUSE_GRACE_MS;
    if (!withinGrace) {
      await revokeFamily(row.familyId, now);
      logger.warn("refresh token reuse detected — session family revoked", { userId: row.userId, familyId: row.familyId });
      throw new UnauthenticatedError();
    }
  }
  if (row.expiresAt <= now) throw new UnauthenticatedError();
  if (!row.user.isActive) {
    await revokeFamily(row.familyId, now);
    throw new UnauthenticatedError();
  }

  if (row.revokedAt) {
    // Benign race (another tab already rotated this token moments ago): issue a sibling, keep the family.
    return (await issue(row.user, row.familyId, meta, now)).session;
  }

  // Claim the token atomically: if a concurrent request rotated it first, count === 0.
  const claimed = await db.refreshToken.updateMany({ where: { id: row.id, revokedAt: null }, data: { revokedAt: now } });
  const { row: next, session } = await issue(row.user, row.familyId, meta, now);
  if (claimed.count === 1) await db.refreshToken.update({ where: { id: row.id }, data: { replacedById: next.id } });
  return session;
}

export async function revokeFamily(familyId: string, now = new Date()): Promise<void> {
  await db.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: now } });
}

export async function logout(rawRefreshToken: string | undefined): Promise<void> {
  if (!rawRefreshToken) return;
  const row = await db.refreshToken.findUnique({ where: { tokenHash: hashToken(rawRefreshToken) }, select: { familyId: true } });
  if (row) await revokeFamily(row.familyId);
}

export async function listSessions(userId: string, currentFamilyId: string, now = new Date()) {
  const active = await db.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
  const started = await db.refreshToken.groupBy({
    by: ["familyId"],
    where: { userId, familyId: { in: active.map((t) => t.familyId) } },
    _min: { createdAt: true },
  });
  const startedAt = new Map(started.map((g) => [g.familyId, g._min.createdAt]));
  const seen = new Set<string>();
  return active
    .filter((t) => (seen.has(t.familyId) ? false : (seen.add(t.familyId), true)))
    .map((t) => ({
      familyId: t.familyId,
      createdAt: startedAt.get(t.familyId) ?? t.createdAt,
      lastUsedAt: t.createdAt,
      userAgent: t.userAgent,
      ip: t.ip,
      current: t.familyId === currentFamilyId,
    }));
}

/** "Sign out everywhere else". Returns the number of other sessions ended. */
export async function revokeOtherSessions(userId: string, currentFamilyId: string): Promise<number> {
  const families = await db.refreshToken.findMany({
    where: { userId, revokedAt: null, familyId: { not: currentFamilyId } },
    distinct: ["familyId"],
    select: { familyId: true },
  });
  if (families.length === 0) return 0;
  await db.refreshToken.updateMany({
    where: { userId, revokedAt: null, familyId: { in: families.map((f) => f.familyId) } },
    data: { revokedAt: new Date() },
  });
  return families.length;
}

// ---------------------------------------------------------------------------
// Account activation & password management
// ---------------------------------------------------------------------------

const samePasswordAsEmail = (password: string, email: string) => password.trim().toLowerCase() === email.toLowerCase();

/** Creates a single-use activation token inside the caller's transaction. Returns the raw token (shown once). */
export async function createActivationToken(tx: Tx, userId: string, now = new Date()): Promise<string> {
  const raw = generateOpaqueToken();
  await tx.activationToken.create({ data: { userId, tokenHash: hashToken(raw), expiresAt: new Date(now.getTime() + ACTIVATION_TTL_MS) } });
  return raw;
}

export async function activate(input: { token: string; password: string }, meta: AuthMeta = {}): Promise<IssuedSession> {
  const now = meta.now ?? new Date();
  const row = await db.activationToken.findUnique({ where: { tokenHash: hashToken(input.token) }, include: { user: true } });
  if (!row) throw new BusinessRuleError("This activation link is not valid. Ask the Registry for a new one.");
  if (row.usedAt) throw new BusinessRuleError("This activation link has already been used. Sign in instead.");
  if (row.expiresAt <= now) throw new BusinessRuleError("This activation link has expired. Ask the Registry for a new one.");
  // Activation only ever sets a *first* password; it must never become a password-reset backdoor.
  if (row.user.passwordHash) throw new BusinessRuleError("This account is already active. Sign in instead.");
  if (samePasswordAsEmail(input.password, row.user.email)) {
    throw new ValidationError("Choose a different password", { password: "Your password can't be your email address" });
  }

  const passwordHash = await hashPassword(input.password);
  const user = await db.$transaction(async (tx) => {
    // Atomic claim: two simultaneous submissions of the same link can't both succeed.
    const claimed = await tx.activationToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
    if (claimed.count === 0) throw new BusinessRuleError("This activation link has already been used. Sign in instead.");
    const u = await tx.user.update({ where: { id: row.userId }, data: { passwordHash, failedLoginCount: 0, lockedUntil: null, lastLoginAt: now } });
    await audit(tx, { actor: `user:${u.email}`, action: "account.activated", entityType: "User", entityId: u.id, studentId: u.studentId });
    return u;
  });
  return (await issue(user, randomUUID(), meta, now)).session;
}

export async function changePassword(
  userId: string,
  input: { currentPassword: string; newPassword: string },
  currentFamilyId: string,
): Promise<{ revokedSessions: number }> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !user.passwordHash) throw new NotFoundError("Account");
  if (user.isDemo) throw new BusinessRuleError("Password changes are disabled on shared demo accounts");
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new ValidationError("Your current password is incorrect", { currentPassword: "Current password is incorrect" });
  }
  if (samePasswordAsEmail(input.newPassword, user.email)) {
    throw new ValidationError("Choose a different password", { newPassword: "Your password can't be your email address" });
  }

  const passwordHash = await hashPassword(input.newPassword);
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await audit(tx, { actor: `user:${user.email}`, action: "account.password_changed", entityType: "User", entityId: userId, studentId: user.studentId });
  });
  // A password change is the moment to kick out anyone else who may have the old one.
  const revokedSessions = await revokeOtherSessions(userId, currentFamilyId);
  return { revokedSessions };
}

/** Staff action: a new activation link for a student whose invitation was lost or expired. */
export async function issueActivationLink(studentId: string, actor: string): Promise<string> {
  const user = await db.user.findUnique({ where: { studentId } });
  if (!user) throw new NotFoundError("Student account");
  if (user.passwordHash) throw new BusinessRuleError("This student has already activated their account");
  return db.$transaction(async (tx) => {
    await tx.activationToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    const raw = await createActivationToken(tx, user.id);
    await audit(tx, { actor, action: "account.activation_issued", entityType: "User", entityId: user.id, studentId });
    return raw;
  });
}
