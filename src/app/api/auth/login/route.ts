import { parseJson, route } from "@/server/http";
import { RateLimitedError } from "@/server/errors";
import { login } from "@/server/services/auth";
import { loginLimiter } from "@/server/auth/rate-limit";
import { authMeta, clientIp, signedInResponse } from "@/server/auth/respond";
import { loginSchema } from "@/lib/validation";

export const POST = route(async (req) => {
  // IP limit first: stops password spraying across many accounts (per-account lockout can't).
  const limit = loginLimiter.hit(clientIp(req));
  if (!limit.allowed) {
    throw new RateLimitedError("Too many sign-in attempts from this network. Try again later.", Math.ceil(limit.retryAfterMs / 1000));
  }
  const input = await parseJson(req, loginSchema);
  return signedInResponse(await login(input, authMeta(req)));
});
