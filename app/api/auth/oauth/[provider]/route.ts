import { NextRequest, NextResponse } from "next/server";
import { buildOAuthStart, setOAuthStateCookie, type OAuthProvider } from "@/app/lib/oauth";

export const runtime = "nodejs";

const providers = new Set(["github", "google"]);

export async function GET(req: NextRequest, ctx: RouteContext<"/api/auth/oauth/[provider]">) {
  const { provider } = await ctx.params;
  if (!providers.has(provider)) {
    return NextResponse.json({ ok: false, error: "Unsupported OAuth provider." }, { status: 404 });
  }
  const start = buildOAuthStart(provider as OAuthProvider, req);
  if (!start.ok) {
    return NextResponse.json({ ok: false, error: start.error }, { status: 503 });
  }
  const res = NextResponse.redirect(start.url);
  setOAuthStateCookie(res, provider as OAuthProvider, start.state);
  return res;
}
