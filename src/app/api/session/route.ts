import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { NotFoundError } from "@/server/errors";
import { parseJson, route } from "@/server/http";
import { SESSION_COOKIE } from "@/lib/session-cookie";
import { sessionSchema } from "@/lib/validation";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 8,
};

/** Role toggle: become Staff, or act as a specific student. */
export const POST = route(async (req) => {
  const body = await parseJson(req, sessionSchema);
  if (body.role === "STUDENT") {
    const exists = await db.student.findUnique({ where: { id: body.studentId }, select: { id: true } });
    if (!exists) throw new NotFoundError("Student");
  }
  const res = NextResponse.json({ ok: true, role: body.role });
  res.cookies.set(SESSION_COOKIE, JSON.stringify(body), cookieOptions);
  return res;
});

export const DELETE = route(async () => {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
