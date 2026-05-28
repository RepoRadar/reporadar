"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { track } from "@/app/lib/analytics";

// Dismissed flag persists across visits so returning users don't see the
// intro every load. Bump the version suffix if the pillars copy changes
// enough that we want everyone to see it again.
const DISMISS_KEY = "rr-intro-dismissed-v1";

// The four live capabilities, in value order. Each badge color tracks the
// green/blue/yellow/red gradient used by the sliders and match-score bars so
// the dashboard reads as one visual language.
const PILLARS: { color: string; title: string; body: string }[] = [
  {
    color: "var(--primary)",
    title: "Search and judge",
    body: "Search any repo and get a scored verdict, not ten tabs to open and guess at.",
  },
  {
    color: "var(--secondary)",
    title: "Scores you tune",
    body: "10 dimensions you control. Move the sliders, the ranking moves, and the bars show why.",
  },
  {
    color: "var(--accent)",
    title: "Alerts that watch",
    body: "Set your thresholds once. We email you when a repo crosses them, instead of you searching again.",
  },
  {
    color: "var(--danger)",
    title: "Ask a repo",
    body: "Open chat on any card and ask if it fits what you already built. It answers against our scores.",
  },
];

export function DashboardIntro() {
  // `null` until we've checked localStorage so SSR and the first client paint
  // agree (no flash of the strip before we know it was dismissed).
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    // Defer to a microtask so we're not setting state synchronously inside the
    // effect body (matches the NotificationSignup localStorage restore pattern).
    const timeout = window.setTimeout(() => {
      try {
        setVisible(window.localStorage.getItem(DISMISS_KEY) === null);
      } catch {
        setVisible(true);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    } catch {
      // Private mode or storage disabled: hide for this session anyway.
    }
    setVisible(false);
    track("intro_dismissed", {});
  }

  if (!visible) return null;

  return (
    <section
      className="rr-fade-up mx-5 mt-5 rounded-2xl border p-4"
      style={{
        borderColor: "var(--border)",
        background:
          "linear-gradient(180deg, rgba(24,29,40,0.96) 0%, rgba(16,20,27,0.98) 100%)",
      }}
      aria-labelledby="dashboard-intro-heading"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="text-[10px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: "var(--fg-dim)" }}
          >
            New here?
          </p>
          <h2
            id="dashboard-intro-heading"
            className="mt-1 text-base font-bold tracking-normal"
          >
            What RepoRadar does
          </h2>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors"
          style={{ borderColor: "var(--border)", color: "var(--fg-dim)" }}
          aria-label="Dismiss the intro"
        >
          Got it
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PILLARS.map((pillar, i) => (
          <div
            key={pillar.title}
            className="flex flex-col gap-1.5 rounded-lg border p-3"
            style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.18)" }}
          >
            <div className="flex items-center gap-2">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                style={{ background: pillar.color, color: "#06080d" }}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <h3 className="text-sm font-semibold tracking-normal">{pillar.title}</h3>
            </div>
            <p
              className="text-[12px] leading-relaxed"
              style={{ color: "var(--fg-muted)" }}
            >
              {pillar.body}
            </p>
          </div>
        ))}
      </div>

      <Link
        href="/blog/why-we-built-reporadar"
        className="mt-3 inline-block text-[12px] font-medium underline-offset-2 hover:underline"
        style={{ color: "var(--primary)" }}
        onClick={() => track("intro_read_more", {})}
      >
        Read the full story and FAQ
      </Link>
    </section>
  );
}
