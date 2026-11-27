import { created, parseJson, route } from "@/server/http";
import { requireStaff } from "@/server/session";
import { addFee, getAccount } from "@/server/services/fees";
import { addFeeSchema } from "@/lib/validation";

type Params = { id: string };

export const GET = route<Params>(async (req, { params }) => {
  await requireStaff(req);
  return getAccount(params.id);
});

/** Add an extra charge (e.g. resit fee). */
export const POST = route<Params>(async (req, { params }) => {
  const user = await requireStaff(req);
  const input = await parseJson(req, addFeeSchema);
  return created(await addFee(params.id, input, user.actor));
});
