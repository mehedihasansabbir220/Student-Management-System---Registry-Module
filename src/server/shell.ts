import "server-only";
import { unstable_rethrow } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "@/server/session";
import { logger } from "@/server/logger";

/**
 * Loads the signed-in user for the app shell. A database outage must not look
 * like "signed out" (that would bounce the user to /login), so it is reported
 * separately and the layout shows an outage notice instead.
 */
export async function loadShellUser(): Promise<{ user: CurrentUser | null; dbDown: boolean }> {
  try {
    return { user: await getCurrentUser(), dbDown: false };
  } catch (err) {
    // Never swallow Next.js control-flow signals (redirect, notFound, dynamic usage).
    unstable_rethrow(err);
    logger.error("shell: failed to load current user", { err });
    return { user: null, dbDown: true };
  }
}
