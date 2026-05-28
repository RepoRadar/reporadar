/**
 * /suggestions — public suggestions voting board.
 *
 * Static shell (force-static, (site) route group) — Workers-safe.
 * No server-side D1 access at page level; all data fetched client-side
 * by SuggestionsBoard via GET /api/suggestions.
 */

import type { Metadata } from "next";
import SuggestionsBoard from "@/app/(site)/_components/SuggestionsBoard";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Suggestions — RepoRadar",
  description:
    "Suggest features for RepoRadar, vote on ideas from the community, and see what the team is working on.",
};

export default function SuggestionsPage() {
  return (
    <>
      <header style={{ marginBottom: "2.5rem" }}>
        <h1
          style={{
            color: "var(--fg)",
            fontSize: "2rem",
            fontWeight: 700,
            lineHeight: 1.2,
            margin: "0 0 0.75rem",
          }}
        >
          Suggestions
        </h1>
        <p
          style={{
            color: "var(--fg-muted)",
            fontSize: "1rem",
            lineHeight: 1.7,
            margin: 0,
            maxWidth: "520px",
          }}
        >
          Have an idea to make RepoRadar better? Submit it below — suggestions
          are visible immediately and the community can vote on them. We review
          and respond to every one.
        </p>
      </header>

      <SuggestionsBoard />

      <p
        style={{
          marginTop: "2.5rem",
          fontSize: "0.8125rem",
          color: "var(--fg-dim)",
          fontFamily: "var(--font-geist-mono)",
        }}
      >
        Prefer GitHub?{" "}
        <a
          href="https://github.com/RepoRadar/reporadar/issues"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--primary)",
            textDecoration: "underline",
            textDecorationColor: "rgba(34,197,94,0.4)",
            textUnderlineOffset: "3px",
          }}
        >
          Open an issue directly
        </a>{" "}
        — we triage regularly.
      </p>
    </>
  );
}
