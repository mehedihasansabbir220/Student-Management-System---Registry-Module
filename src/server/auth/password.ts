import "server-only";
import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password hashing with scrypt (memory-hard, built into Node — no native deps).
 * Stored as `scrypt$N$r$p$<salt b64>$<hash b64>` so parameters can be raised
 * later without breaking existing hashes.
 */

const N = 16384;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

function scrypt(password: string, salt: Buffer, keylen: number, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keylen, opts, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = await scrypt(plain.normalize("NFKC"), salt, KEY_LEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [n, r, p] = parts.slice(1, 4).map(Number);
  if (![n, r, p].every((x) => Number.isInteger(x) && x > 0)) return false;
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  if (salt.length === 0 || expected.length === 0) return false;
  try {
    const actual = await scrypt(plain.normalize("NFKC"), salt, expected.length, { N: n, r, p, maxmem: 256 * 1024 * 1024 });
    // Constant-time comparison: no early exit that leaks how many bytes matched.
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
