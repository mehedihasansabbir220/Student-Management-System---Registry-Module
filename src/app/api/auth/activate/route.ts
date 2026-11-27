import { parseJson, route } from "@/server/http";
import { activate } from "@/server/services/auth";
import { authMeta, signedInResponse } from "@/server/auth/respond";
import { activateSchema } from "@/lib/validation";

export const POST = route(async (req) => {
  const input = await parseJson(req, activateSchema);
  return signedInResponse(await activate(input, authMeta(req)));
});
