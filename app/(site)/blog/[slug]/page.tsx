/**
 * /blog/[slug] — Static per-post page.
 * All post slugs are pre-rendered at build time via generateStaticParams.
 * Content is bundled from app/content/blog — NO runtime filesystem reads (D-00).
 * Must appear as ● (SSG prerendered) in `npm run build` output.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { posts } from "@/app/content/blog";
import Prose from "@/app/(site)/_components/Prose";

export const dynamic = "force-static";
export const dynamicParams = false;

/** Pre-render every known post slug at build time. */
export function generateStaticParams(): Array<{ slug: string }> {
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) return { title: "Not Found — RepoRadar" };
  return {
    title: `${post.title} — RepoRadar`,
    description: post.summary,
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) notFound();

  return (
    <article>
      <header style={{ marginBottom: "2.5rem" }}>
        <h1
          style={{
            color: "var(--fg)",
            fontSize: "2rem",
            fontWeight: 700,
            margin: "0 0 0.5rem",
            lineHeight: 1.2,
          }}
        >
          {post.title}
        </h1>
        <time
          dateTime={post.date}
          style={{
            color: "var(--secondary)",
            fontSize: "0.8rem",
            fontFamily: "var(--font-geist-mono)",
            display: "block",
            marginBottom: "0.75rem",
          }}
        >
          {post.date}
        </time>
        <p
          style={{
            color: "var(--fg-muted)",
            fontSize: "1rem",
            lineHeight: 1.65,
            margin: 0,
            fontStyle: "italic",
            borderLeft: "3px solid var(--primary)",
            paddingLeft: "0.75rem",
          }}
        >
          {post.summary}
        </p>
      </header>
      <Prose markdown={post.body} />
    </article>
  );
}
