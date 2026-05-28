import type { Metadata } from "next";
import Image from "next/image";
import { fetchRepoContext, isValidFullName } from "@/app/lib/repoContext";
import RepoPane from "./RepoPane";

export const runtime = "nodejs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}): Promise<Metadata> {
  const { repo } = await params;
  return {
    title: `${repo} | RepoRadar chat`,
  };
}

export default async function ChatWorkspace({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;
  const fullName = `${owner}/${repo}`;

  // Gate on invalid full name (T-04-12: path traversal / injection).
  if (!isValidFullName(fullName)) {
    return <NotAvailable owner={owner} repo={repo} />;
  }

  let ctx: Awaited<ReturnType<typeof fetchRepoContext>> | null = null;
  try {
    ctx = await fetchRepoContext(fullName);
  } catch {
    // T-04-13: never expose raw errors or stack traces.
    return <NotAvailable owner={owner} repo={repo} />;
  }

  const apiKeyPresent = Boolean(process.env.GOOGLE_API_KEY);

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
      }}
    >
      {/* Page header: 48px, sticky */}
      <header
        style={{
          height: "48px",
          position: "sticky",
          top: 0,
          zIndex: 10,
          borderBottom: "1px solid var(--border)",
          background: "var(--bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          gap: "12px",
          flexShrink: 0,
        }}
      >
        {/* Left: wordmark + separator + repo name */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
          <a
            href="/"
            style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", flexShrink: 0 }}
          >
            <Image
              src="/reporadar-mark.svg"
              alt="RepoRadar mark"
              width={28}
              height={28}
            />
            <span style={{ fontSize: "1rem", fontWeight: 800, lineHeight: 1 }}>
              <span style={{ color: "var(--fg)" }}>Repo</span>
              <span style={{ color: "var(--primary)" }}>Radar</span>
            </span>
          </a>
          <span style={{ color: "var(--fg-dim)", fontSize: "0.875rem" }}>/</span>
          <span
            className="font-mono text-sm"
            style={{ color: "var(--fg-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {owner}/{repo}
          </span>
        </div>

        {/* Right: back link */}
        <a
          href="/"
          className="text-xs font-mono"
          style={{ color: "var(--secondary)", flexShrink: 0, textDecoration: "none" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--fg)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--secondary)"; }}
        >
          &larr; Back to dashboard
        </a>
      </header>

      {/* Two-pane body */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "row",
          gap: "24px",
          padding: "24px",
          minHeight: 0,
        }}
      >
        {/* Left pane: 55% - chat shell (ChatClient mounts here in 04-04) */}
        <div
          style={{
            flex: "0 0 55%",
            minWidth: "320px",
            height: "calc(100dvh - 48px - 48px)",
            overflowY: "auto",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Chat header: repo name, trust line, not-saved note */}
          <div
            style={{
              borderBottom: "1px solid var(--border)",
              paddingBottom: "12px",
              marginBottom: "16px",
            }}
          >
            <div
              className="text-xl font-bold"
              style={{
                color: "var(--fg)",
                maxWidth: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {repo}
            </div>
            <div
              className="text-xs"
              style={{ color: "var(--fg-muted)", marginTop: "4px" }}
            >
              {"Grounded in this repo's README, file tree, and RepoRadar scores"}
            </div>
            <div
              className="text-xs font-mono"
              style={{ color: "var(--fg-dim)", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}
            >
              <LockIcon />
              Not saved. Conversations end when you close this tab.
            </div>
          </div>

          {/* ChatClient mounts here in 04-04 */}
          {/* Props to pass: fullName, repoName (repo), ctx (RepoContext), apiKeyPresent */}
          {/* Placeholder content until 04-04 wires the client component */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--fg-dim)",
              fontSize: "0.8125rem",
              fontFamily: "var(--font-geist-mono)",
            }}
          >
            {apiKeyPresent ? (
              <span>Chat loading&hellip;</span>
            ) : (
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "16px",
                  background: "var(--surface-2)",
                  textAlign: "center",
                }}
              >
                Chat is not available right now.
              </div>
            )}
          </div>
        </div>

        {/* Right pane: 45% - repo context */}
        <div
          style={{
            flex: "0 0 45%",
            minWidth: "280px",
            height: "calc(100dvh - 48px - 48px)",
            overflowY: "auto",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "24px",
          }}
        >
          <RepoPane ctx={ctx} />
        </div>
      </div>
    </div>
  );
}

// Small lock/info icon for the not-saved note, 10px, aria-hidden.
function LockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width={10}
      height={10}
      fill="currentColor"
      style={{ flexShrink: 0 }}
    >
      <path d="M4 5v1.5A1.5 1.5 0 0 0 2.5 8v5A1.5 1.5 0 0 0 4 14.5h8a1.5 1.5 0 0 0 1.5-1.5V8A1.5 1.5 0 0 0 12 6.5V5a4 4 0 0 0-8 0Zm1.5 0a2.5 2.5 0 0 1 5 0v1.5h-5V5ZM4 8h8v5H4V8Z" />
    </svg>
  );
}

// Repo not-available state: clean message, back link, try-again link.
// No stack traces, no raw error messages (T-04-13).
function NotAvailable({ owner, repo }: { owner: string; repo: string }) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: "24px",
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          width: "100%",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <h1
          className="text-xl font-bold"
          style={{ color: "var(--fg)" }}
        >
          This repo is not available.
        </h1>
        <p
          className="text-sm leading-relaxed"
          style={{ color: "var(--fg-muted)" }}
        >
          {owner}/{repo} could not be loaded. It may be private, have been deleted, or GitHub may be unavailable right now.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface)",
              color: "var(--fg-muted)",
              textDecoration: "none",
            }}
          >
            &larr; Back to dashboard
          </a>
          <a
            href={`/chat/${owner}/${repo}`}
            className="inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition"
            style={{
              borderColor: "var(--primary)",
              background: "rgba(34,197,94,0.08)",
              color: "var(--primary)",
              textDecoration: "none",
            }}
          >
            Try again
          </a>
        </div>
      </div>
    </div>
  );
}
