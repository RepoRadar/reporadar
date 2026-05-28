/**
 * ChatWorkspaceSkeleton - Loading fallback for the /chat/[owner]/[repo] route.
 * Renders shimmer placeholders for both panes while fetchRepoContext resolves.
 * Uses the .rr-shimmer class from globals.css (rr-shimmer keyframe + bg).
 */
export default function Loading() {
  return <ChatWorkspaceSkeleton />;
}

function ShimmerLine({ width = "100%", height = "14px" }: { width?: string; height?: string }) {
  return (
    <div
      className="rr-shimmer"
      style={{ width, height, borderRadius: "6px" }}
    />
  );
}

function ChatWorkspaceSkeleton() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: "var(--bg)",
      }}
    >
      {/* Page header skeleton */}
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
          padding: "0 24px",
          gap: "12px",
        }}
      >
        <ShimmerLine width="180px" height="20px" />
        <ShimmerLine width="120px" height="14px" />
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
        {/* Left pane skeleton */}
        <div
          style={{
            flex: "0 0 55%",
            minWidth: "320px",
            height: "calc(100dvh - 48px - 48px)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Chat header shimmer: title + short trust line */}
          <div
            style={{
              borderBottom: "1px solid var(--border)",
              paddingBottom: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <ShimmerLine width="60%" height="22px" />
            <ShimmerLine width="80%" height="12px" />
          </div>

          {/* Message area: empty (no fake bubbles) */}
          <div style={{ flex: 1 }} />

          {/* Suggested chip shimmers: 4 chips */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {[180, 220, 200, 240].map((w, i) => (
              <div
                key={i}
                className="rr-shimmer"
                style={{ width: `${w}px`, height: "36px", borderRadius: "8px" }}
              />
            ))}
          </div>

          {/* Composer shimmer */}
          <div
            className="rr-shimmer"
            style={{ height: "68px", borderRadius: "12px" }}
          />
        </div>

        {/* Right pane skeleton */}
        <div
          style={{
            flex: "0 0 45%",
            minWidth: "280px",
            height: "calc(100dvh - 48px - 48px)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "16px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            overflowY: "auto",
          }}
        >
          {/* Identity row shimmers */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <ShimmerLine width="50%" height="18px" />
            <ShimmerLine width="70%" height="12px" />
          </div>

          {/* Dimension bar shimmers: 10 bars */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <ShimmerLine width="45%" height="11px" />
                  <ShimmerLine width="28px" height="11px" />
                </div>
                <ShimmerLine width="100%" height="4px" />
              </div>
            ))}
            {/* Overall score row shimmer */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <ShimmerLine width="55%" height="11px" />
                <ShimmerLine width="32px" height="11px" />
              </div>
              <ShimmerLine width="100%" height="4px" />
            </div>
          </div>

          {/* README shimmer */}
          <div
            className="rr-shimmer"
            style={{ height: "320px", borderRadius: "8px" }}
          />

          {/* File tree shimmer */}
          <div
            className="rr-shimmer"
            style={{ height: "120px", borderRadius: "8px" }}
          />
        </div>
      </div>
    </div>
  );
}
