"use client";

import Link from "next/link";
import { DONATION_URL, GITHUB_URL, HACKATHON_URL } from "@/app/lib/links";

/**
 * On-brand product footer.
 * Mounted AFTER the dashboard grid in RepoRadarApp (D-13) — never
 * overlaps the frozen header, cards, or sliders.
 */
export function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border)",
        background: "var(--bg)",
        color: "var(--fg-dim)",
      }}
    >
      <div
        className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 sm:flex-row sm:items-start sm:justify-between"
      >
        {/* Wordmark + tagline */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold tracking-tight" aria-label="RepoRadar">
            <span style={{ color: "var(--fg)" }}>Repo</span>
            <span style={{ color: "var(--primary)" }}>Radar</span>
          </span>
          <span className="text-xs" style={{ color: "var(--fg-dim)" }}>
            Stop scrolling. Start building.
          </span>
        </div>

        {/* Nav links */}
        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap gap-x-6 gap-y-3 text-xs"
        >
          {/* Internal pages */}
          <Link
            href="/changelog"
            className="transition-colors hover:underline underline-offset-2"
            style={{ color: "var(--fg-muted)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--primary)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--fg-muted)"; }}
          >
            Changelog
          </Link>
          <Link
            href="/blog"
            className="transition-colors hover:underline underline-offset-2"
            style={{ color: "var(--fg-muted)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--primary)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--fg-muted)"; }}
          >
            Blog
          </Link>
          <Link
            href="/contact"
            className="transition-colors hover:underline underline-offset-2"
            style={{ color: "var(--fg-muted)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--primary)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--fg-muted)"; }}
          >
            Contact
          </Link>

          {/* Suggest a feature — links to the public suggestions voting board */}
          <Link
            href="/suggestions"
            className="transition-colors hover:underline underline-offset-2"
            style={{ color: "var(--fg-muted)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--primary)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--fg-muted)"; }}
          >
            Suggest a feature
          </Link>

          {/* Donation — outbound, no payment integration (D-10) */}
          <a
            href={DONATION_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Buy us a coffee — support RepoRadar on Ko-fi (opens in new tab)"
            className="transition-colors hover:underline underline-offset-2"
            style={{ color: "var(--fg-muted)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--accent)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--fg-muted)"; }}
          >
            ☕ Buy us a coffee
          </a>

          {/* GitHub */}
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="RepoRadar on GitHub (opens in new tab)"
            className="flex items-center gap-1 transition-colors hover:underline underline-offset-2"
            style={{ color: "var(--fg-muted)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--fg)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "var(--fg-muted)"; }}
          >
            {/* GitHub mark SVG — real brand icon, allowed per AGENTS.md */}
            <svg
              aria-hidden="true"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            GitHub repo
          </a>

          {/* Frozen hackathon link — exact text required (AGENTS.md) */}
          <a
            href={HACKATHON_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Open the AI Tinkerers Generative UI Hackathon handbook in a new tab ↗"
            aria-label="AI Tinkerers Generative UI Hackathon (opens in new tab)"
            className="transition-colors hover:underline underline-offset-2"
            style={{ color: "var(--secondary)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.8"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
          >
            AI Tinkerers Generative UI Hackathon
          </a>
        </nav>
      </div>

      {/* Copyright bar */}
      <div
        className="mx-auto max-w-7xl border-t px-6 py-3 text-[11px]"
        style={{ borderColor: "var(--border)", color: "var(--fg-dim)" }}
      >
        © {new Date().getFullYear()} RepoRadar
      </div>
    </footer>
  );
}
