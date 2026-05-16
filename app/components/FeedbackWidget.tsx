"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type FeedbackStatus = "idle" | "sending" | "created" | "queued" | "error";

type FeedbackResponse = {
  ok: boolean;
  error?: string;
  issue?: {
    status: "created" | "queued";
    url?: string;
    verified?: {
      title?: string;
    };
  };
};

export function FeedbackWidget({ context }: { context: string }) {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<FeedbackStatus>("idle");
  const [message, setMessage] = useState("");
  const [issueTitle, setIssueTitle] = useState("");
  const [issueUrl, setIssueUrl] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = feedback.trim();
    if (!trimmed) {
      setStatus("error");
      setMessage("Add a review or feedback note first.");
      return;
    }

    setStatus("sending");
    setMessage("Verifying feedback with AI...");
    setIssueTitle("");
    setIssueUrl("");

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          feedback: trimmed,
          contact: contact.trim() || undefined,
          pageUrl: window.location.href,
          context,
        }),
      });
      const body = (await res.json()) as FeedbackResponse;
      if (!res.ok || !body.ok || !body.issue) {
        throw new Error(body.error || "Feedback could not be sent.");
      }
      setStatus(body.issue.status === "created" ? "created" : "queued");
      setMessage(body.issue.status === "created" ? "Issue created" : "Issue queued");
      setIssueTitle(body.issue.verified?.title || "Feedback issue");
      setIssueUrl(body.issue.url || "");
      setFeedback("");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Feedback could not be sent.");
    }
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Review or feedback"
        aria-expanded={open}
        className="rounded-md border px-3 py-1.5 text-[11px] font-mono font-semibold uppercase tracking-[0.12em] transition"
        style={{
          borderColor: open ? "var(--primary)" : "var(--border-strong)",
          background: open ? "rgba(34,197,94,0.12)" : "var(--surface-2)",
          color: open ? "var(--primary)" : "var(--fg-muted)",
          boxShadow: open ? "0 0 12px var(--primary-glow)" : "none",
        }}
      >
        Feedback
      </button>

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+0.6rem)] z-50 w-[min(90vw,24rem)] rounded-lg border p-4 shadow-2xl"
          style={{
            borderColor: "var(--border-strong)",
            background: "var(--surface)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          }}
        >
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                  Send review
                </h2>
                <p className="mt-1 text-xs leading-5" style={{ color: "var(--fg-dim)" }}>
                  AI verifies the note, then opens a triage issue when GitHub is configured.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close feedback"
                className="rounded px-1.5 py-0.5 text-sm transition"
                style={{ color: "var(--fg-dim)" }}
              >
                x
              </button>
            </div>

            <label className="flex flex-col gap-1.5 text-xs" style={{ color: "var(--fg-muted)" }}>
              Review or feedback
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                rows={5}
                maxLength={4000}
                className="resize-none rounded-md border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: "var(--border)",
                  background: "#080b12",
                  color: "var(--fg)",
                }}
                placeholder="What should be fixed, improved, or preserved?"
              />
            </label>

            <label className="flex flex-col gap-1.5 text-xs" style={{ color: "var(--fg-muted)" }}>
              Contact (optional)
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                maxLength={120}
                className="rounded-md border px-3 py-2 text-sm outline-none"
                style={{
                  borderColor: "var(--border)",
                  background: "#080b12",
                  color: "var(--fg)",
                }}
                placeholder="@github or email"
              />
            </label>

            <button
              type="submit"
              disabled={status === "sending"}
              className="rounded-md border px-3 py-2 text-xs font-mono font-semibold uppercase tracking-[0.14em] transition disabled:opacity-60"
              style={{
                borderColor: "var(--primary)",
                background: "var(--primary)",
                color: "#08070d",
              }}
            >
              {status === "sending" ? "Sending..." : "Send feedback"}
            </button>
          </form>

          {message && (
            <div
              className="mt-3 rounded-md border px-3 py-2 text-xs"
              role="status"
              aria-live="polite"
              style={{
                borderColor: status === "error" ? "var(--danger)" : "var(--border)",
                background: status === "error" ? "rgba(239,68,68,0.08)" : "var(--surface-2)",
                color: status === "error" ? "var(--danger)" : "var(--fg-muted)",
              }}
            >
              <div style={{ color: status === "error" ? "var(--danger)" : "var(--primary)" }}>
                {message}
              </div>
              {issueTitle && <div className="mt-1" style={{ color: "var(--fg)" }}>{issueTitle}</div>}
              {issueUrl && (
                <a
                  href={issueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block underline underline-offset-2"
                  style={{ color: "var(--secondary)" }}
                >
                  Open GitHub issue
                </a>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
