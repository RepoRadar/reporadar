"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

type FeedbackMode = "feedback" | "feature";
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

// External open hook event name. Dispatch this from anywhere (e.g. footer link) to open
// the widget. Optionally pass { type: "feature" } to open in feature mode:
//   window.dispatchEvent(new CustomEvent("reporadar:open-feedback", { detail: { type: "feature" } }))
const OPEN_EVENT = "reporadar:open-feedback";

const COPY = {
  feedback: {
    title: "Send review",
    helper: "AI verifies the note, then opens a triage issue when GitHub is configured.",
    label: "Review or feedback",
    placeholder: "What should be fixed, improved, or preserved?",
    submit: "Send feedback",
    sending: "Sending...",
  },
  feature: {
    title: "Suggest a feature",
    helper: "Describe what you need. AI scopes it into a feature request on GitHub.",
    label: "Feature suggestion",
    placeholder: "What feature would make RepoRadar more useful for you?",
    submit: "Send suggestion",
    sending: "Sending...",
  },
} as const;

export function FeedbackWidget({ context, showButton = true }: { context: string; showButton?: boolean }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<FeedbackMode>("feedback");
  const [feedback, setFeedback] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<FeedbackStatus>("idle");
  const [message, setMessage] = useState("");
  const [issueTitle, setIssueTitle] = useState("");
  const [issueUrl, setIssueUrl] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Outside-click / Escape close
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

  // External open hook — dispatch `reporadar:open-feedback` with optional { type: "feature" }
  useEffect(() => {
    const onOpenEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ type?: string }>).detail;
      setMode(detail?.type === "feature" ? "feature" : "feedback");
      setOpen(true);
    };
    window.addEventListener(OPEN_EVENT, onOpenEvent);
    return () => window.removeEventListener(OPEN_EVENT, onOpenEvent);
  }, []);

  const copy = COPY[mode];

  const resetForm = () => {
    setStatus("idle");
    setMessage("");
    setIssueTitle("");
    setIssueUrl("");
    setFeedback("");
  };

  const handleModeChange = (next: FeedbackMode) => {
    setMode(next);
    resetForm();
  };

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
          type: mode,
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
      {showButton && (
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
      )}

      {open && (
        <div
          className="absolute right-0 top-[calc(100%+0.6rem)] z-50 w-[min(90vw,24rem)] rounded-lg border p-4 shadow-2xl"
          style={{
            borderColor: "var(--border-strong)",
            background: "var(--surface)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
          }}
        >
          {/* Segmented toggle: Review / Suggest a feature */}
          <div
            className="mb-3 flex rounded-md border text-[11px] font-mono font-semibold uppercase tracking-[0.1em] overflow-hidden"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
            role="group"
            aria-label="Feedback mode"
          >
            {(["feedback", "feature"] as FeedbackMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleModeChange(m)}
                aria-pressed={mode === m}
                className="flex-1 px-2 py-1.5 transition"
                style={{
                  background: mode === m ? "rgba(34,197,94,0.14)" : "transparent",
                  color: mode === m ? "var(--primary)" : "var(--fg-dim)",
                  borderRight: m === "feedback" ? "1px solid var(--border)" : undefined,
                  boxShadow: mode === m ? "inset 0 0 0 1px var(--primary)" : "none",
                }}
              >
                {m === "feedback" ? "Review" : "Suggest a feature"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                  {copy.title}
                </h2>
                <p className="mt-1 text-xs leading-5" style={{ color: "var(--fg-dim)" }}>
                  {copy.helper}
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
              {copy.label}
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
                placeholder={copy.placeholder}
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
              {status === "sending" ? copy.sending : copy.submit}
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
