/**
 * RepoPane - Right pane of the chat workspace.
 * Server component: no "use client". Static for the session lifetime.
 * Renders: identity row (one GitHub link), 10 RepoRadar dimension bars,
 * overall score bar, README via react-markdown, and capped file-tree links.
 *
 * Security: react-markdown used in safe mode (no raw HTML plugin, no dangerouslySetInnerHTML).
 * All file-tree and README links open in a new tab with noopener noreferrer.
 * Title tooltips are scoped to small label elements only (not the whole pane).
 */
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import type { RepoContext } from "@/app/lib/repoContext";
import { blobUrl, treeUrl } from "@/app/lib/repoContext";
import { DIMENSION_META, DIMENSION_ORDER } from "@/app/lib/types";

const RADAR_GRADIENT =
  "linear-gradient(90deg, var(--primary), var(--secondary), var(--accent), var(--danger))";

const TREE_DISPLAY_CAP = 30;

function formatStars(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function formatPushedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Compact markdown component map for the README pane.
// Headings sized per UI-SPEC: h1 text-lg, h2 text-base, h3 text-sm.
// Links always open in a new tab. No raw HTML rendering plugin used.
const readmeComponents: Components = {
  h1: ({ children }) => (
    <h1 style={{ color: "var(--fg)", fontSize: "1.125rem", fontWeight: 700, margin: "1rem 0 0.5rem" }}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ color: "var(--fg)", fontSize: "1rem", fontWeight: 600, margin: "0.875rem 0 0.4rem" }}>
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ color: "var(--fg-muted)", fontSize: "0.875rem", fontWeight: 600, margin: "0.75rem 0 0.35rem" }}>
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p style={{ color: "var(--fg-muted)", fontSize: "0.8125rem", lineHeight: 1.65, margin: "0 0 0.75rem" }}>
      {children}
    </p>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: "var(--secondary)", textDecoration: "underline", textDecorationColor: "rgba(59,130,246,0.35)", textUnderlineOffset: "2px" }}
    >
      {children}
    </a>
  ),
  strong: ({ children }) => (
    <strong style={{ color: "var(--fg)", fontWeight: 600 }}>{children}</strong>
  ),
  em: ({ children }) => (
    <em style={{ color: "var(--fg-muted)", fontStyle: "italic" }}>{children}</em>
  ),
  ul: ({ children }) => (
    <ul style={{ color: "var(--fg-muted)", paddingLeft: "1.25rem", margin: "0 0 0.75rem", lineHeight: 1.6 }}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol style={{ color: "var(--fg-muted)", paddingLeft: "1.25rem", margin: "0 0 0.75rem", lineHeight: 1.6 }}>
      {children}
    </ol>
  ),
  li: ({ children }) => <li style={{ margin: "0.2rem 0" }}>{children}</li>,
  code: ({ children, className }) => {
    const isBlock = Boolean(className);
    if (isBlock) {
      return (
        <code style={{ fontFamily: "var(--font-geist-mono)", fontSize: "0.8125rem", color: "var(--fg-muted)" }}>
          {children}
        </code>
      );
    }
    return (
      <code
        style={{
          fontFamily: "var(--font-geist-mono)",
          fontSize: "0.8125em",
          background: "var(--surface-3)",
          color: "var(--primary)",
          padding: "0.1em 0.35em",
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
        background: "var(--surface-3)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        padding: "12px",
        overflowX: "auto",
        margin: "0.75rem 0",
        fontFamily: "var(--font-geist-mono)",
        fontSize: "0.8125rem",
        lineHeight: 1.5,
        color: "var(--fg-muted)",
      }}
    >
      {children}
    </pre>
  ),
  blockquote: ({ children }) => (
    <blockquote
      style={{
        borderLeft: "3px solid var(--secondary)",
        paddingLeft: "0.75rem",
        margin: "0.75rem 0",
        color: "var(--fg-dim)",
        fontStyle: "italic",
      }}
    >
      {children}
    </blockquote>
  ),
  hr: () => <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "1rem 0" }} />,
};

// Inline SVG icons for the file tree. Real folder and file icons, not decorative.
function FolderIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width={12} height={12} fill="currentColor" style={{ flexShrink: 0, color: "var(--accent)" }}>
      <path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width={12} height={12} fill="currentColor" style={{ flexShrink: 0, color: "var(--fg-dim)" }}>
      <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25V1.75Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 10.5 4.25V1.5H3.75Zm6.75.56v2.19c0 .138.112.25.25.25h2.19L10.5 2.06Z" />
    </svg>
  );
}

// Inline SVG for the GitHub mark, matching RepoCard.tsx.
function GitHubMark({ size = 13 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="currentColor"
      style={{ flexShrink: 0 }}
    >
      <path d="M8 0C3.58 0 0 3.67 0 8.2c0 3.62 2.29 6.69 5.47 7.77.4.08.55-.18.55-.4l-.01-1.4c-2.23.5-2.7-1.1-2.7-1.1-.36-.95-.89-1.2-.89-1.2-.73-.51.06-.5.06-.5.8.06 1.23.85 1.23.85.72 1.26 1.88.9 2.34.68.07-.53.28-.9.51-1.1-1.78-.2-3.64-.91-3.64-4.05 0-.9.31-1.63.82-2.2-.08-.21-.36-1.04.08-2.17 0 0 .67-.22 2.2.84A7.45 7.45 0 0 1 8 3.95c.68 0 1.36.09 2 .27 1.52-1.06 2.19-.84 2.19-.84.44 1.13.16 1.96.08 2.17.51.57.82 1.3.82 2.2 0 3.15-1.87 3.84-3.65 4.05.29.26.54.76.54 1.53l-.01 2.24c0 .22.15.48.55.4A8.13 8.13 0 0 0 16 8.2C16 3.67 12.42 0 8 0Z" />
    </svg>
  );
}

export default function RepoPane({ ctx }: { ctx: RepoContext }) {
  const { owner, repo, fullName, htmlUrl, language, stars, license, pushedAt, homepage, dimensions, overall, readme, treePaths, treePathsTruncated } = ctx;
  const overallPct = Math.round(overall * 100);

  // Cap tree entries for display, sort dirs first (they end with "/").
  const displayPaths = treePaths.slice(0, TREE_DISPLAY_CAP);
  const remainingCount = treePaths.length - displayPaths.length;
  const treeHasMore = treePathsTruncated || remainingCount > 0;
  const treeRootUrl = `https://github.com/${fullName}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Identity row */}
      <div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "6px" }}>
          <span
            className="text-base font-bold font-mono"
            style={{ color: "var(--fg)" }}
          >
            {owner}/{repo}
          </span>
          {/* One and only one GitHub hub link for this pane */}
          <a
            href={htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${owner}/${repo} on GitHub`}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 font-mono text-[11px] rr-gh-btn"
            style={{
              background: "var(--surface-3)",
              flexShrink: 0,
              height: "28px",
            }}
          >
            <GitHubMark size={13} />
            GitHub repo
          </a>
        </div>

        {/* Stats line */}
        <div className="text-xs font-mono" style={{ color: "var(--fg-muted)", display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center" }}>
          {language && (
            <>
              <span style={{ color: "var(--secondary)" }}>{language}</span>
              <span style={{ color: "var(--fg-dim)" }}>·</span>
            </>
          )}
          <span>★ {formatStars(stars)}</span>
          {license && (
            <>
              <span style={{ color: "var(--fg-dim)" }}>·</span>
              <span>{license}</span>
            </>
          )}
          <span style={{ color: "var(--fg-dim)" }}>·</span>
          <span>last pushed {formatPushedAt(pushedAt)}</span>
        </div>

        {homepage && (
          <div style={{ marginTop: "4px" }}>
            <a
              href={homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs"
              style={{ color: "var(--secondary)", textDecoration: "underline", textDecorationColor: "rgba(59,130,246,0.35)", textUnderlineOffset: "2px" }}
            >
              {homepage}
            </a>
          </div>
        )}
      </div>

      {/* Dimension bars: all 10 RepoRadar dimensions */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {DIMENSION_ORDER.map((dim) => {
          const score = Math.round(dimensions[dim]);
          const meta = DIMENSION_META[dim];
          return (
            <div key={dim} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span
                  className="text-xs font-mono"
                  style={{ color: "var(--fg-muted)" }}
                  title={meta.help}
                >
                  {meta.label}
                </span>
                <span
                  className="text-xs font-mono font-semibold"
                  style={{ color: "var(--primary)" }}
                >
                  {score}/100
                </span>
              </div>
              <div
                style={{
                  height: "4px",
                  width: "100%",
                  borderRadius: "9999px",
                  background: "var(--surface-3)",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${score}%`,
                    borderRadius: "9999px",
                    background: RADAR_GRADIENT,
                    boxShadow: "0 0 6px var(--primary-glow)",
                  }}
                />
              </div>
            </div>
          );
        })}

        {/* Overall RepoRadar score row */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            borderTop: "1px solid var(--border)",
            paddingTop: "12px",
            marginTop: "4px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span
              className="text-xs font-mono font-semibold"
              style={{ color: "var(--fg)" }}
            >
              Overall RepoRadar score
            </span>
            <span
              className="text-xs font-mono font-bold"
              style={{ color: "var(--primary)" }}
            >
              {overallPct}/100
            </span>
          </div>
          <div
            style={{
              height: "4px",
              width: "100%",
              borderRadius: "9999px",
              background: "var(--surface-3)",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${overallPct}%`,
                borderRadius: "9999px",
                background: RADAR_GRADIENT,
                boxShadow: "0 0 6px var(--primary-glow)",
              }}
            />
          </div>
        </div>
      </div>

      {/* README section */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "8px",
          }}
        >
          <span
            className="text-[10px] font-mono uppercase tracking-[0.14em]"
            style={{ color: "var(--fg-dim)" }}
          >
            {"Readme"}
          </span>
          <a
            href={`${htmlUrl}#readme`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono"
            style={{ color: "var(--secondary)" }}
          >
            View on GitHub
          </a>
        </div>

        {readme.text ? (
          <div
            tabIndex={0}
            aria-label="README content, scrollable"
            style={{
              overflowY: "auto",
              maxHeight: "480px",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "16px",
              background: "var(--surface-2)",
            }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={readmeComponents}>
              {readme.text}
            </ReactMarkdown>
          </div>
        ) : (
          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "16px",
              background: "var(--surface-2)",
            }}
          >
            <p
              className="text-sm font-mono"
              style={{ color: "var(--fg-dim)" }}
            >
              No README found for this repo. The chat can still answer from the file tree and RepoRadar scores.
            </p>
          </div>
        )}
      </div>

      {/* File tree section */}
      <div>
        <div style={{ marginBottom: "8px" }}>
          <span
            className="text-[10px] font-mono uppercase tracking-[0.14em]"
            style={{ color: "var(--fg-dim)" }}
          >
            Click around the repo
          </span>
        </div>

        <div
          tabIndex={0}
          aria-label="Top-level file tree, scrollable"
          style={{
            overflowY: "auto",
            maxHeight: "240px",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "8px 12px",
            background: "var(--surface-2)",
          }}
        >
          {displayPaths.length === 0 ? (
            <span className="text-xs font-mono" style={{ color: "var(--fg-dim)" }}>
              No file tree available for this repo.
            </span>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {displayPaths.map((path) => {
                const isDir = path.endsWith("/");
                const href = isDir
                  ? treeUrl(fullName, path.slice(0, -1))
                  : blobUrl(fullName, path);
                return (
                  <a
                    key={path}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 py-1 text-xs font-mono rr-tree-link"
                    style={{ textDecoration: "none" }}
                  >
                    {isDir ? <FolderIcon /> : <FileIcon />}
                    <span>{path}</span>
                  </a>
                );
              })}
              {treeHasMore && (
                <a
                  href={treeRootUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 py-1 text-xs font-mono rr-tree-more"
                  style={{ textDecoration: "none", marginTop: "2px" }}
                >
                  {remainingCount > 0 ? `${remainingCount} more paths, browse on GitHub` : "More paths available, browse on GitHub"} &rarr;
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
