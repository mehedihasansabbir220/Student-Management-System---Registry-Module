import "server-only";
import { Prisma } from "@prisma/client";
import { ConflictError } from "./errors";

/**
 * Translate a unique-constraint violation on a known column into a
 * field-level ConflictError; rethrow anything else untouched.
 */
export function rethrowUnique(err: unknown, messages: Record<string, string>): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    const target = ([] as string[]).concat((err.meta?.target as string[] | string) ?? []);
    for (const field of Object.keys(messages)) {
      if (target.some((t) => t === field || t.includes(`_${field}_`))) {
        throw new ConflictError(messages[field], { [field]: messages[field] });
      }
    }
  }
  throw err;
}
