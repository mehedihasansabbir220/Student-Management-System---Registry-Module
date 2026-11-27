import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config";
import { logger } from "./logger";

/**
 * Local-disk file storage. The interface (save / read / remove by key) is
 * intentionally tiny so it can be swapped for S3 / Azure Blob without touching
 * the submission service.
 */

export function resolveStoragePath(key: string): string {
  const root = config().uploadDir;
  const full = path.resolve(root, key);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error(`Storage key escapes upload directory: ${key}`);
  }
  return full;
}

export async function saveFile(key: string, bytes: Uint8Array) {
  const full = resolveStoragePath(key);
  await mkdir(path.dirname(full), { recursive: true });
  // "wx" = fail if it already exists; keys are UUIDs so this should never collide.
  await writeFile(full, bytes, { flag: "wx" });
}

export async function readStoredFile(key: string): Promise<Buffer> {
  return readFile(resolveStoragePath(key));
}

/** Best-effort delete. A leftover orphan file is logged, never fatal. */
export async function removeFile(key: string) {
  try {
    await rm(resolveStoragePath(key), { force: true });
  } catch (err) {
    logger.warn("failed to remove stored file", { key, err });
  }
}
