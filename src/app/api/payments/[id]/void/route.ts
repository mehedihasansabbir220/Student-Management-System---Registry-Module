import { parseJson, route } from "@/server/http";
import { requirePermission } from "@/server/session";
import { voidPayment } from "@/server/services/fees";
import { voidPaymentSchema } from "@/lib/validation";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requirePermission(req, "payments.void");
  const { reason } = await parseJson(req, voidPaymentSchema);
  return voidPayment(params.id, reason, user.actor);
});
