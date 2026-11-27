import { parseJson, route } from "@/server/http";
import { requireStaff } from "@/server/session";
import { voidPayment } from "@/server/services/fees";
import { voidPaymentSchema } from "@/lib/validation";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireStaff(req);
  const { reason } = await parseJson(req, voidPaymentSchema);
  return voidPayment(params.id, reason, user.actor);
});
