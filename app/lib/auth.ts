import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { NextRequest, NextResponse } from "next/server";

const scrypt = promisify(scryptCb);

export type AuthProvider = "github" | "google" | "password";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  provider: AuthProvider;
  avatarUrl?: string;
  createdAt: string;
};

type PasswordUser = AuthUser & {
  passwordHash: string;
};

type AuthSession = {
  token: string;
  userId: string;
  expiresAt: number;
};

const usersByEmail = new Map<string, PasswordUser>();
const usersById = new Map<string, AuthUser>();
const sessions = new Map<string, AuthSession>();

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeAuthEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : null;
}

export function validatePassword(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length < 12) return null;
  if (!/[a-z]/i.test(value)) return null;
  if (!/[0-9]/.test(value)) return null;
  return value;
}

export function authCookieName() {
  return process.env.NODE_ENV === "production" ? "__Host-rr_session" : "rr_session";
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [scheme, salt, hash] = storedHash.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(hash, "base64url");
  if (derived.byteLength !== expected.byteLength) return false;
  return timingSafeEqual(derived, expected);
}

export async function registerPasswordUser({
  name,
  email,
  password,
}: {
  name?: string;
  email: string;
  password: string;
}): Promise<AuthUser> {
  if (usersByEmail.has(email)) {
    throw new Error("An account already exists for this email.");
  }
  const now = new Date().toISOString();
  const user: PasswordUser = {
    id: `usr_${randomBytes(12).toString("base64url")}`,
    email,
    name: name?.trim() || email.split("@")[0],
    provider: "password",
    passwordHash: await hashPassword(password),
    createdAt: now,
  };
  usersByEmail.set(email, user);
  usersById.set(user.id, toPublicUser(user));
  return toPublicUser(user);
}

export async function loginPasswordUser(email: string, password: string): Promise<AuthUser | null> {
  const user = usersByEmail.get(email);
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  return ok ? toPublicUser(user) : null;
}

export function upsertOAuthUser({
  email,
  name,
  provider,
  avatarUrl,
}: {
  email: string;
  name: string;
  provider: Exclude<AuthProvider, "password">;
  avatarUrl?: string;
}): AuthUser {
  const existing = usersByEmail.get(email);
  if (existing) return toPublicUser(existing);
  const user: PasswordUser = {
    id: `usr_${randomBytes(12).toString("base64url")}`,
    email,
    name,
    provider,
    avatarUrl,
    passwordHash: "",
    createdAt: new Date().toISOString(),
  };
  usersByEmail.set(email, user);
  usersById.set(user.id, toPublicUser(user));
  return toPublicUser(user);
}

export function createSession(user: AuthUser): string {
  const token = `rr_${randomBytes(32).toString("base64url")}`;
  sessions.set(token, {
    token,
    userId: user.id,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(authCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(authCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function getSessionUser(req: NextRequest): AuthUser | null {
  const token = req.cookies.get(authCookieName())?.value;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return usersById.get(session.userId) ?? null;
}

export function destroySession(req: NextRequest) {
  const token = req.cookies.get(authCookieName())?.value;
  if (token) sessions.delete(token);
}

function toPublicUser(user: PasswordUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    provider: user.provider,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };
}
