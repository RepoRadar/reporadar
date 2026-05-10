import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/app/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = getSessionUser(req);
  return NextResponse.json({ ok: true, user });
}
