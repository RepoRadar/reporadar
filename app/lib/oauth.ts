import { randomBytes } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export type OAuthProvider = "github" | "google";

export type OAuthProfile = {
  email: string;
  name: string;
  avatarUrl?: string;
};

export function oauthStateCookie(provider: OAuthProvider) {
  return `rr_oauth_${provider}_state`;
}

export function authBaseUrl(req: NextRequest) {
  return process.env.AUTH_URL || req.nextUrl.origin;
}

export function oauthConfig(provider: OAuthProvider) {
  if (provider === "github") {
    return {
      clientId: process.env.GITHUB_OAUTH_CLIENT_ID,
      clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
      authorizeUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      scopes: "read:user user:email",
    };
  }

  return {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: "openid email profile",
  };
}

export function buildOAuthStart(provider: OAuthProvider, req: NextRequest) {
  const config = oauthConfig(provider);
  if (!config.clientId || !config.clientSecret) {
    return { ok: false as const, error: `${provider} OAuth is not configured.` };
  }

  const state = randomBytes(24).toString("base64url");
  const redirectUri = `${authBaseUrl(req)}/api/auth/oauth/${provider}/callback`;
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scopes);
  url.searchParams.set("state", state);
  if (provider === "google") {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "select_account");
  }

  return { ok: true as const, state, url };
}

export function setOAuthStateCookie(res: NextResponse, provider: OAuthProvider, state: string) {
  res.cookies.set(oauthStateCookie(provider), state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
}

export async function exchangeOAuthCode(
  provider: OAuthProvider,
  req: NextRequest,
  code: string,
): Promise<OAuthProfile> {
  const config = oauthConfig(provider);
  if (!config.clientId || !config.clientSecret) {
    throw new Error(`${provider} OAuth is not configured.`);
  }
  const redirectUri = `${authBaseUrl(req)}/api/auth/oauth/${provider}/callback`;
  const tokenRes = await fetch(config.tokenUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) throw new Error(`OAuth token exchange failed (${tokenRes.status}).`);
  const tokenJson = (await tokenRes.json()) as { access_token?: string; id_token?: string };
  if (!tokenJson.access_token) throw new Error("OAuth provider did not return an access token.");

  return provider === "github"
    ? fetchGitHubProfile(tokenJson.access_token)
    : fetchGoogleProfile(tokenJson.access_token);
}

async function fetchGitHubProfile(accessToken: string): Promise<OAuthProfile> {
  const headers = {
    authorization: `Bearer ${accessToken}`,
    accept: "application/vnd.github+json",
  };
  const [profileRes, emailsRes] = await Promise.all([
    fetch("https://api.github.com/user", { headers }),
    fetch("https://api.github.com/user/emails", { headers }),
  ]);
  if (!profileRes.ok || !emailsRes.ok) throw new Error("Could not load GitHub profile.");
  const profile = (await profileRes.json()) as { name?: string; login?: string; avatar_url?: string };
  const emails = (await emailsRes.json()) as Array<{ email: string; primary: boolean; verified: boolean }>;
  const email = emails.find((item) => item.primary && item.verified)?.email;
  if (!email) throw new Error("GitHub account has no verified primary email.");
  return {
    email: email.toLowerCase(),
    name: profile.name || profile.login || email,
    avatarUrl: profile.avatar_url,
  };
}

async function fetchGoogleProfile(accessToken: string): Promise<OAuthProfile> {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Could not load Google profile.");
  const profile = (await res.json()) as { email?: string; name?: string; picture?: string; email_verified?: boolean };
  if (!profile.email || profile.email_verified === false) {
    throw new Error("Google account has no verified email.");
  }
  return {
    email: profile.email.toLowerCase(),
    name: profile.name || profile.email,
    avatarUrl: profile.picture,
  };
}
