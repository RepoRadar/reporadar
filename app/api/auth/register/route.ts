import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  normalizeAuthEmail,
  registerPasswordUser,
  setSessionCookie,
  validatePassword,
} from "@/app/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const email = normalizeAuthEmail(body?.email);
  const password = validatePassword(body?.password);
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!email) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json(
      { ok: false, error: "Password must be at least 12 characters and include a number." },
      { status: 400 },
    );
  }

  try {
    const user = await registerPasswordUser({ name, email, password });
    const token = createSession(user);
    const res = NextResponse.json({ ok: true, user });
    setSessionCookie(res, token);
    return res;
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Could not create account." },
      { status: 409 },
    );
  }
}
