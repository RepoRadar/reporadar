/**
 * Shared layout for the (site) route group.
 * Route group parentheses mean this layout applies to /changelog, /blog, /blog/[slug]
 * WITHOUT adding a URL segment.
 *
 * Intentionally minimal: a centered content column with a back link.
 * Does NOT touch the dashboard header, cards, or sliders (hackathon freeze).
 */
import type { ReactNode } from "react";
import Link from "next/link";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: "var(--bg)",
        color: "var(--fg)",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          maxWidth: "720px",
          margin: "0 auto",
          padding: "2rem 1.5rem 4rem",
        }}
      >
        <nav style={{ marginBottom: "2rem" }}>
          <Link
            href="/"
            style={{
              color: "var(--primary)",
              textDecoration: "none",
              fontSize: "0.875rem",
              fontFamily: "var(--font-geist-mono)",
              letterSpacing: "0.01em",
            }}
          >
            ← RepoRadar
          </Link>
        </nav>
        {children}
      </div>
    </div>
  );
}
