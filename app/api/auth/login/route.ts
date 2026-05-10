import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  loginPasswordUser,
  normalizeAuthEmail,
  setSessionCookie,
} from "@/app/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const email = normalizeAuthEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ ok: false, error: "Email and password are required." }, { status: 400 });
  }

  const user = await loginPasswordUser(email, password);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, user });
  setSessionCookie(res, createSession(user));
  return res;
}
