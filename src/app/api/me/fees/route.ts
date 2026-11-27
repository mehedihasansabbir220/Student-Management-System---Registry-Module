import { route } from "@/server/http";
import { requireStudent } from "@/server/session";
import { getAccount } from "@/server/services/fees";

export const GET = route(async (req) => {
  const user = await requireStudent(req);
  const { fees, payments, account } = await getAccount(user.studentId);
  // Students see their payments, not internal staff notes / void reasons.
  return { fees, payments: payments.map(({ notes: _notes, voidReason: _voidReason, ...p }) => p), account };
});
