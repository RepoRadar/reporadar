/**
 * /changelog/rss.xml — RSS 2.0 feed for the changelog.
 * Parsed from the bundled changelog markdown (app/content/changelog.ts) — NO runtime
 * filesystem reads (D-00). Statically rendered at build time (force-static), so it's
 * cheap to serve and Workers-safe.
 */
import { changelog } from "@/app/content/changelog";

export const dynamic = "force-static";

const SITE = "https://reporadar.io";

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!),
  );
}

// Parse "## YYYY-MM-DD: Title" (or "— Title") sections out of the changelog markdown into feed items.
function parseEntries(md: string): { date: string; title: string; body: string }[] {
  const entries: { date: string; title: string; body: string }[] = [];
  let cur: { date: string; title: string; body: string } | null = null;
  for (const line of md.split("\n")) {
    const m = line.match(/^##\s+(\d{4}-\d{2}-\d{2})\s+[:—-]\s+(.+)$/);
    if (m) {
      if (cur) entries.push(cur);
      cur = { date: m[1], title: m[2].trim(), body: "" };
    } else if (cur && line.trim() !== "---") {
      cur.body += line + "\n";
    }
  }
  if (cur) entries.push(cur);
  return entries;
}

export async function GET(): Promise<Response> {
  const entries = parseEntries(changelog);

  const items = entries
    .map((e) => {
      const pubDate = new Date(`${e.date}T12:00:00Z`).toUTCString();
      return `    <item>
      <title>${escapeXml(e.title)}</title>
      <link>${SITE}/changelog</link>
      <guid isPermaLink="false">reporadar-changelog-${e.date}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(e.body.trim())}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>RepoRadar Changelog</title>
    <link>${SITE}/changelog</link>
    <atom:link href="${SITE}/changelog/rss.xml" rel="self" type="application/rss+xml" />
    <description>All notable changes to RepoRadar, newest first.</description>
    <language>en-us</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
