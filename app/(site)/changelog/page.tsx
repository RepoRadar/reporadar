/**
 * /changelog — Static changelog page.
 * Content is bundled from app/content/changelog.ts — NO runtime filesystem reads (D-00).
 * Statically rendered at build time; must appear as ○ (Static) in `npm run build` output.
 */
import type { Metadata } from "next";
import { changelog } from "@/app/content/changelog";
import Prose from "@/app/(site)/_components/Prose";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Changelog — RepoRadar",
  description:
    "All notable changes to RepoRadar, curated and kept up to date.",
};

export default function ChangelogPage() {
  return (
    <article>
      <header style={{ marginBottom: "2.5rem" }}>
        <h1
          style={{
            color: "var(--fg)",
            fontSize: "2rem",
            fontWeight: 700,
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          Changelog
        </h1>
        <p
          style={{
            color: "var(--fg-dim)",
            fontSize: "0.9rem",
            marginTop: "0.5rem",
            fontFamily: "var(--font-geist-mono)",
          }}
        >
          All notable changes to RepoRadar, newest first.
        </p>
      </header>
      <Prose markdown={changelog} />
    </article>
  );
}
