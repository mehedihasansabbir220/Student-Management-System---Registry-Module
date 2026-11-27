import { created, parseJson, route } from "@/server/http";
import { requireStaff } from "@/server/session";
import { recordPayment } from "@/server/services/fees";
import { recordPaymentSchema } from "@/lib/validation";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireStaff(req);
  const input = await parseJson(req, recordPaymentSchema);
  return created(await recordPayment(params.id, input, user.actor));
});
