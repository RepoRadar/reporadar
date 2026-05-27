/**
 * /blog — Static blog list page.
 * Content is bundled from app/content/blog/index.ts — NO runtime filesystem reads (D-00).
 * Statically rendered at build time; must appear as ○ (Static) in `npm run build` output.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { posts } from "@/app/content/blog";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Blog — RepoRadar",
  description:
    "Articles about how and why we built RepoRadar, and how it scores repos.",
};

export default function BlogListPage() {
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
          Blog
        </h1>
        <p
          style={{
            color: "var(--fg-dim)",
            fontSize: "0.9rem",
            marginTop: "0.5rem",
            fontFamily: "var(--font-geist-mono)",
          }}
        >
          How and why we built RepoRadar.
        </p>
      </header>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        {posts.map((post) => (
          <li
            key={post.slug}
            style={{
              borderBottom: "1px solid var(--border)",
              paddingBottom: "1.5rem",
            }}
          >
            <Link
              href={`/blog/${post.slug}`}
              style={{
                color: "var(--fg)",
                textDecoration: "none",
                display: "block",
              }}
            >
              <h2
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 600,
                  margin: "0 0 0.25rem",
                  color: "var(--fg)",
                  lineHeight: 1.3,
                }}
              >
                {post.title}
              </h2>
            </Link>
            <time
              dateTime={post.date}
              style={{
                color: "var(--secondary)",
                fontSize: "0.8rem",
                fontFamily: "var(--font-geist-mono)",
                display: "block",
                marginBottom: "0.5rem",
              }}
            >
              {post.date}
            </time>
            <p
              style={{
                color: "var(--fg-muted)",
                fontSize: "0.9375rem",
                lineHeight: 1.65,
                margin: 0,
              }}
            >
              {post.summary}
            </p>
          </li>
        ))}
      </ul>
    </article>
  );
}
