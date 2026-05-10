import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, destroySession } from "@/app/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  destroySession(req);
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  return res;
}
