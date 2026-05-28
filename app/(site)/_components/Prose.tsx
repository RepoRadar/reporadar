/**
 * Prose — Server Component markdown renderer.
 * Uses react-markdown + remark-gfm; styled with globals.css tokens.
 * NO "use client" — stays a Server Component so pages remain statically renderable.
 * NO rehype-raw — embedded HTML/script in markdown is intentionally inert (T-02-01).
 */
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { ReactNode } from "react";

/**
 * Extract anchor ID from heading children that end with {#id}.
 * Renders the heading with that id and strips the {#id} suffix from display.
 */
function extractHeadingId(children: ReactNode): { id?: string; label: ReactNode } {
  const raw = children?.toString() || "";
  const match = raw.match(/\s*\{#([\w-]+)\}\s*$/);
  if (match) {
    const id = match[1];
    const before = raw.slice(0, raw.lastIndexOf("{#"));
    return { id, label: before.trim() };
  }
  return { label: children };
}

const components: Components = {
  h1: ({ children }) => (
    <h1
      style={{
        color: "var(--fg)",
        fontSize: "1.875rem",
        fontWeight: 700,
        lineHeight: 1.2,
        margin: "2rem 0 1rem",
        borderBottom: "1px solid var(--border)",
        paddingBottom: "0.5rem",
      }}
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => {
    const { id, label } = extractHeadingId(children);
    return (
      <h2
        id={id}
        style={{
          color: "var(--fg)",
          fontSize: "1.375rem",
          fontWeight: 600,
          lineHeight: 1.3,
          margin: "2rem 0 0.75rem",
        }}
      >
        {label}
      </h2>
    );
  },
  h3: ({ children }) => (
    <h3
      style={{
        color: "var(--fg)",
        fontSize: "1.125rem",
        fontWeight: 600,
        lineHeight: 1.4,
        margin: "1.5rem 0 0.5rem",
      }}
    >
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4
      style={{
        color: "var(--fg-muted)",
        fontSize: "1rem",
        fontWeight: 600,
        margin: "1.25rem 0 0.5rem",
      }}
    >
      {children}
    </h4>
  ),
  p: ({ children }) => (
    <p
      style={{
        color: "var(--fg-muted)",
        fontSize: "1rem",
        lineHeight: 1.75,
        margin: "0 0 1rem",
      }}
    >
      {children}
    </p>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      style={{
        color: "var(--primary)",
        textDecoration: "underline",
        textDecorationColor: "rgba(34, 197, 94, 0.4)",
        textUnderlineOffset: "3px",
      }}
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong style={{ color: "var(--fg)", fontWeight: 600 }}>
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em style={{ color: "var(--fg-muted)", fontStyle: "italic" }}>
      {children}
    </em>
  ),
  ul: ({ children }) => (
    <ul
      style={{
        color: "var(--fg-muted)",
        paddingLeft: "1.5rem",
        margin: "0 0 1rem",
        lineHeight: 1.75,
      }}
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol
      style={{
        color: "var(--fg-muted)",
        paddingLeft: "1.5rem",
        margin: "0 0 1rem",
        lineHeight: 1.75,
      }}
    >
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li style={{ margin: "0.25rem 0" }}>{children}</li>
  ),
  blockquote: ({ children }) => (
    <blockquote
      style={{
        borderLeft: "3px solid var(--secondary)",
        paddingLeft: "1rem",
        margin: "1.25rem 0",
        color: "var(--fg-dim)",
        fontStyle: "italic",
      }}
    >
      {children}
    </blockquote>
  ),
  code: ({ children, className }) => {
    // Block code fences have a className like "language-xxx"
    const isBlock = Boolean(className);
    if (isBlock) {
      return (
        <code
          style={{
            fontFamily: "var(--font-geist-mono)",
            fontSize: "0.875rem",
            color: "var(--fg-muted)",
            background: "transparent",
          }}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        style={{
          fontFamily: "var(--font-geist-mono)",
          fontSize: "0.875em",
          background: "var(--surface)",
          color: "var(--primary)",
          padding: "0.15em 0.4em",
          borderRadius: "4px",
          border: "1px solid var(--border)",
        }}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "1rem 1.25rem",
        overflowX: "auto",
        margin: "1.25rem 0",
        fontFamily: "var(--font-geist-mono)",
        fontSize: "0.875rem",
        lineHeight: 1.6,
        color: "var(--fg-muted)",
      }}
    >
      {children}
    </pre>
  ),
  hr: () => (
    <hr
      style={{
        border: "none",
        borderTop: "1px solid var(--border)",
        margin: "2rem 0",
      }}
    />
  ),
  table: ({ children }) => (
    <div style={{ overflowX: "auto", margin: "1.25rem 0" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.9rem",
          color: "var(--fg-muted)",
        }}
      >
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th
      style={{
        textAlign: "left",
        padding: "0.5rem 0.75rem",
        borderBottom: "1px solid var(--border-strong)",
        color: "var(--fg)",
        fontWeight: 600,
        fontSize: "0.875rem",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td
      style={{
        padding: "0.5rem 0.75rem",
        borderBottom: "1px solid var(--border)",
        verticalAlign: "top",
      }}
    >
      {children}
    </td>
  ),
};

interface ProseProps {
  markdown: string;
}

/**
 * On-brand markdown renderer.
 * Server Component — no client JS bundle cost.
 * react-markdown does NOT render raw HTML by default (no rehype-raw) — safe for team-authored content.
 */
export default function Prose({ markdown }: ProseProps) {
  return (
    <div style={{ wordBreak: "break-word" }}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
