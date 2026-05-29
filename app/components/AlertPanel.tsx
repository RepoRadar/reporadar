"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { NotificationSignup } from "@/app/components/NotificationSignup";
import { track } from "@/app/lib/analytics";

const OPEN_STATE_KEY = "reporadar-alert-panel-open-v1";

export type AlertPanelHandle = {
  // Expand the panel and scroll it into view. Optional prefill seeds the form
  // with whatever the caller (e.g. the contextual prompt) wants watched.
  open: (prefill?: { term?: string; kind?: "topic" | "query" }) => void;
};

/**
 * Collapsible wrapper around <NotificationSignup>.
 *
 * Default state is collapsed: a compact, glowing "Set an alert" affordance so
 * the radar and sliders below it are immediately visible. Clicking it expands
 * the full signup panel and scrolls it into view. The open/closed choice is
 * remembered for the session (sessionStorage) so it does not snap shut on a
 * re-render, but resets on a fresh tab.
 *
 * The parent can open it imperatively via the forwarded ref (used by the
 * contextual "Watch this?" prompt to hand off to the full panel).
 */
export function AlertPanel({ ref }: { ref?: React.Ref<AlertPanelHandle> }) {
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState<{ term?: string; kind?: "topic" | "query" }>({});
  const sectionRef = useRef<HTMLDivElement | null>(null);

  // Restore session open-state on mount (kept in an effect so SSR + first
  // client paint agree — sessionStorage is client-only).
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        if (window.sessionStorage.getItem(OPEN_STATE_KEY) === "1") setOpen(true);
      } catch {
        /* sessionStorage blocked — stay collapsed */
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const persist = (next: boolean) => {
    try {
      window.sessionStorage.setItem(OPEN_STATE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const expand = useCallback((seed?: { term?: string; kind?: "topic" | "query" }) => {
    if (seed) setPrefill(seed);
    setOpen(true);
    persist(true);
    // Wait a tick for the panel to mount, then bring it into view.
    window.setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }, []);

  const collapse = () => {
    setOpen(false);
    persist(false);
  };

  useImperativeHandle(ref, () => ({ open: expand }), [expand]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          track("alert_panel_expand", { source: "affordance" });
          expand();
        }}
        className="rr-pulse rr-fade-up group flex w-full items-center gap-3 rounded-xl border p-4 text-left transition hover:brightness-110"
        style={{
          borderColor: "rgba(34,197,94,0.45)",
          background:
            "linear-gradient(135deg, rgba(34,197,94,0.14) 0%, rgba(59,130,246,0.10) 100%)",
        }}
        aria-expanded={false}
        aria-label="Set an alert: get emailed when a topic you watch starts trending"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-base"
          style={{
            background: "rgba(34,197,94,0.18)",
            color: "var(--primary)",
            boxShadow: "0 0 14px var(--primary-glow)",
          }}
          aria-hidden
        >
          {/* bell glyph */}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold" style={{ color: "var(--fg)" }}>
            Set an alert
          </span>
          <span className="block text-xs leading-5" style={{ color: "var(--fg-muted)" }}>
            We&apos;ll email you when a topic you watch starts trending.
          </span>
        </span>
        <span
          className="shrink-0 text-lg transition group-hover:translate-x-0.5"
          style={{ color: "var(--primary)" }}
          aria-hidden
        >
          ›
        </span>
      </button>
    );
  }

  return (
    <div ref={sectionRef} className="flex flex-col gap-1">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={collapse}
          className="rounded px-1.5 py-0.5 text-[11px] transition hover:underline"
          style={{ color: "var(--fg-dim)" }}
          aria-label="Collapse the alert panel"
        >
          collapse
        </button>
      </div>
      <NotificationSignup initialTerm={prefill.term} initialKind={prefill.kind} />
    </div>
  );
}
