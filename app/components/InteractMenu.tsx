"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DONATION_URL } from "@/app/lib/links";

type InteractItem = {
  label: string;
  href?: string;
  external?: boolean;
  action?: () => void;
  desc?: string;
};

const OPEN_EVENT = "reporadar:open-feedback";

/**
 * "Interact" dropdown — replaces the standalone Feedback button in the header.
 *
 * Items:
 *   About       → /blog/why-we-built-reporadar
 *   Blog        → /blog
 *   Contact     → /contact
 *   Donations   → ko-fi (external)
 *   FAQ         → /blog?faq (scrolls to FAQ section, or links to a dedicated FAQ post)
 *   Refer a Friend → share link / copy
 *   Suggestions → opens the FeedbackWidget panel (dispatches custom event)
 */
export function InteractMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Outside-click / Escape close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const openSuggestions = useCallback(() => {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { type: "feature" } }));
    setOpen(false);
  }, []);

  const handleRefer = useCallback(async () => {
    try {
      await navigator.clipboard.writeText("https://reporadar.io");
      alert("Link copied — share RepoRadar with a friend!");
    } catch {
      // Fallback: show the URL
      window.prompt("Copy this link to share:", "https://reporadar.io");
    }
    setOpen(false);
  }, []);

  // Labels only — no subtitles (Christo's call). Changelog sits under the last item.
  const items: InteractItem[] = [
    { label: "About", href: "/blog/why-we-built-reporadar" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/contact" },
    { label: "Donations", href: DONATION_URL, external: true },
    { label: "FAQ", href: "/blog/why-we-built-reporadar#faq" },
    { label: "Refer a Friend", action: handleRefer },
    { label: "Suggestions", action: openSuggestions },
    { label: "Changelog", href: "/changelog" },
  ];

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Interact with RepoRadar"
        aria-expanded={open}
        className="rounded-md border px-3 py-1.5 text-[11px] font-mono font-semibold uppercase tracking-[0.12em] transition"
        style={{
          borderColor: open ? "var(--primary)" : "var(--border-strong)",
          background: open ? "rgba(34,197,94,0.12)" : "var(--surface-2)",
          color: open ? "var(--primary)" : "var(--fg-muted)",
          boxShadow: open ? "0 0 12px var(--primary-glow)" : "none",
        }}
      >
        Interact
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+0.6rem)] z-50 w-[min(90vw,16rem)] rounded-lg border p-1.5 shadow-2xl"
          style={{
            borderColor: "var(--border-strong)",
            background: "var(--surface)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          }}
        >
          {items.map((item) => {
            if (item.action) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs transition"
                  style={{ color: "var(--fg-muted)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.04)";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--fg)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-muted)";
                  }}
                >
                  <span className="font-medium">{item.label}</span>
                  {item.desc && (
                    <span className="ml-2 truncate text-[10px]" style={{ color: "var(--fg-dim)" }}>
                      {item.desc}
                    </span>
                  )}
                </button>
              );
            }

            const linkProps = {
              href: item.href || "#",
              ...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {}),
            };

            return (
              <Link
                key={item.label}
                {...linkProps}
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-md px-3 py-2 text-xs transition"
                style={{ color: "var(--fg-muted)", textDecoration: "none" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.04)";
                  (e.currentTarget as HTMLAnchorElement).style.color = "var(--fg)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                  (e.currentTarget as HTMLAnchorElement).style.color = "var(--fg-muted)";
                }}
              >
                <span className="font-medium">{item.label}</span>
                {item.desc && (
                  <span className="ml-2 truncate text-[10px]" style={{ color: "var(--fg-dim)" }}>
                    {item.desc}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
