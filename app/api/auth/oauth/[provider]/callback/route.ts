import { NextRequest, NextResponse } from "next/server";
import { createSession, setSessionCookie, upsertOAuthUser } from "@/app/lib/auth";
import {
  authBaseUrl,
  exchangeOAuthCode,
  oauthStateCookie,
  type OAuthProvider,
} from "@/app/lib/oauth";

export const runtime = "nodejs";

const providers = new Set(["github", "google"]);

export async function GET(req: NextRequest, ctx: RouteContext<"/api/auth/oauth/[provider]/callback">) {
  const { provider } = await ctx.params;
  const baseUrl = authBaseUrl(req);
  if (!providers.has(provider)) {
    return NextResponse.redirect(`${baseUrl}/login?auth_error=unsupported-provider`);
  }

  const expectedState = req.cookies.get(oauthStateCookie(provider as OAuthProvider))?.value;
  const state = req.nextUrl.searchParams.get("state");
  const code = req.nextUrl.searchParams.get("code");
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(`${baseUrl}/login?auth_error=invalid-oauth-state`);
  }

  try {
    const profile = await exchangeOAuthCode(provider as OAuthProvider, req, code);
    const user = upsertOAuthUser({ ...profile, provider: provider as OAuthProvider });
    const res = NextResponse.redirect(baseUrl);
    setSessionCookie(res, createSession(user));
    res.cookies.delete(oauthStateCookie(provider as OAuthProvider));
    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : "oauth-failed";
    const url = new URL("/login", baseUrl);
    url.searchParams.set("auth_error", message);
    return NextResponse.redirect(url);
  }
}
