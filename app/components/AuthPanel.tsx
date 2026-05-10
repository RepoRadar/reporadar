"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AuthMode = "login" | "register";
type AuthState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "ready"; message: string }
  | { kind: "error"; message: string };

type AuthUser = {
  email: string;
  name: string;
  provider: string;
};

export function AuthPanel() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<AuthState>({ kind: "idle" });
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((body) => setUser(body.user ?? null))
      .catch(() => setUser(null));
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setState({ kind: "submitting" });
    const res = await fetch(`/api/auth/${mode === "register" ? "register" : "login"}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    const body = await res.json();
    if (!res.ok || !body.ok) {
      setState({ kind: "error", message: body.error ?? "Authentication failed." });
      return;
    }
    setUser(body.user);
    setState({ kind: "ready", message: `Signed in as ${body.user.email}` });
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setState({ kind: "idle" });
  };

  return (
    <main className="min-h-screen px-5 py-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_420px]">
        <section className="flex min-h-[32rem] flex-col justify-between rounded-xl border p-6 lg:p-8" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div>
            <Link href="/" className="font-mono text-sm" style={{ color: "var(--primary)" }}>← RepoRadar</Link>
            <h1 className="mt-10 max-w-2xl text-4xl font-black tracking-normal lg:text-6xl">
              Sign in to save your radar.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6" style={{ color: "var(--fg-muted)" }}>
              Account access is being staged behind a WIP PR. Email/password works in local runtime memory now; GitHub and Google OAuth routes are wired and ready for provider secrets.
            </p>
          </div>
          <div className="mt-8 grid gap-3 text-xs font-mono sm:grid-cols-3">
            {["HttpOnly sessions", "OAuth state cookies", "D1 schema ready"].map((item) => (
              <div key={item} className="rounded-lg border px-3 py-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--fg-muted)" }}>
                <span style={{ color: "var(--primary)" }}>●</span> {item}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border p-5" style={{ borderColor: "var(--border-strong)", background: "linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%)" }}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">Account access</h2>
            <span className="rounded-md border px-2 py-1 text-[10px] font-mono" style={{ borderColor: "rgba(234,179,8,0.35)", color: "var(--accent)" }}>
              WIP
            </span>
          </div>

          {user ? (
            <div className="mt-5 rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.18)" }}>
              <p className="text-sm font-semibold">Signed in</p>
              <p className="mt-1 text-sm" style={{ color: "var(--fg-muted)" }}>{user.name} · {user.email}</p>
              <p className="mt-1 text-[11px] font-mono" style={{ color: "var(--secondary)" }}>{user.provider}</p>
              <button onClick={logout} className="mt-4 h-10 w-full rounded-md border text-sm font-semibold" style={{ borderColor: "var(--border-strong)", color: "var(--fg)" }}>
                Sign out
              </button>
            </div>
          ) : (
            <>
              <div className="mt-5 grid grid-cols-2 gap-2">
                <Link href="/api/auth/oauth/github" prefetch={false} className="flex h-11 items-center justify-center rounded-md border text-sm font-semibold" style={{ borderColor: "var(--border-strong)", color: "var(--fg)" }}>
                  GitHub
                </Link>
                <Link href="/api/auth/oauth/google" prefetch={false} className="flex h-11 items-center justify-center rounded-md border text-sm font-semibold" style={{ borderColor: "var(--border-strong)", color: "var(--fg)" }}>
                  Google
                </Link>
              </div>

              <div className="my-5 flex items-center gap-3 text-[10px] font-mono uppercase tracking-[0.18em]" style={{ color: "var(--fg-dim)" }}>
                <span className="h-px flex-1" style={{ background: "var(--border)" }} />
                Email
                <span className="h-px flex-1" style={{ background: "var(--border)" }} />
              </div>

              <div className="grid grid-cols-2 rounded-md border p-1" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.18)" }}>
                {(["login", "register"] as const).map((nextMode) => (
                  <button
                    key={nextMode}
                    type="button"
                    onClick={() => setMode(nextMode)}
                    className="rounded px-3 py-2 text-xs font-semibold capitalize"
                    style={{
                      background: mode === nextMode ? "var(--primary)" : "transparent",
                      color: mode === nextMode ? "#06080d" : "var(--fg-muted)",
                    }}
                  >
                    {nextMode === "login" ? "Sign in" : "Create"}
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
                {mode === "register" && (
                  <label className="text-xs" style={{ color: "var(--fg-muted)" }}>
                    Name
                    <input value={name} onChange={(event) => setName(event.target.value)} className="rr-auth-input mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none" />
                  </label>
                )}
                <label className="text-xs" style={{ color: "var(--fg-muted)" }}>
                  Email
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="rr-auth-input mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none" />
                </label>
                <label className="text-xs" style={{ color: "var(--fg-muted)" }}>
                  Password
                  <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="rr-auth-input mt-1 w-full rounded-md border px-3 py-2 text-sm outline-none" />
                </label>
                <button disabled={state.kind === "submitting"} className="h-11 rounded-md text-sm font-bold disabled:opacity-60" style={{ background: "linear-gradient(90deg, var(--primary), var(--secondary))", color: "#06080d" }}>
                  {state.kind === "submitting" ? "Checking..." : mode === "login" ? "Sign in" : "Create account"}
                </button>
              </form>
            </>
          )}

          <div className="mt-4 min-h-10" aria-live="polite">
            {state.kind === "ready" && <p className="text-sm" style={{ color: "var(--primary)" }}>{state.message}</p>}
            {state.kind === "error" && <p className="text-sm" style={{ color: "var(--danger)" }}>{state.message}</p>}
            {state.kind === "idle" && <p className="text-xs leading-5" style={{ color: "var(--fg-dim)" }}>Production deploy remains blocked until OAuth secrets and D1 persistence are configured.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
