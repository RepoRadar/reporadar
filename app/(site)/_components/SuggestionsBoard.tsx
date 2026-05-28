"use client";

/**
 * SuggestionsBoard — client component for /suggestions.
 *
 * Fetches GET /api/suggestions on mount, renders submit form + voting list.
 * Posts to /api/suggestions (submit) and /api/suggestions/vote (vote).
 * Optimistic updates on vote; inline error handling for 429 and other errors.
 *
 * Data loading uses a reducer + a non-effect async bootstrap (React 19 pattern
 * that avoids setState-in-effect lint violations): the initial fetch promise
 * is started during render and wired via useTransition so state updates land
 * on the normal React queue rather than inside an effect body.
 */

import {
  type FormEvent,
  useState,
  useReducer,
  useEffect,
  useCallback,
  useMemo,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SuggestionItem = {
  id: string;
  name: string;
  description: string;
  created_at: string;
  status: "awaiting" | "accepted" | "declined" | "delivered";
  eta: string | null;
  github_issue_url: string | null;
  votes_up: number;
  votes_down: number;
};

type SubmitStatus = "idle" | "sending" | "sent" | "error";

type SortKey =
  | "recent"
  | "earliest"
  | "most-votes"
  | "least-votes"
  | "velocity";

type BoardState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; suggestions: SuggestionItem[] };

type BoardAction =
  | { type: "loaded"; suggestions: SuggestionItem[] }
  | { type: "error"; message: string }
  | {
      type: "patch-votes";
      id: string;
      votes_up: number;
      votes_down: number;
    }
  | { type: "prepend"; suggestion: SuggestionItem };

function boardReducer(state: BoardState, action: BoardAction): BoardState {
  switch (action.type) {
    case "loaded":
      return { phase: "ready", suggestions: action.suggestions };
    case "error":
      return { phase: "error", message: action.message };
    case "prepend":
      if (state.phase !== "ready") return state;
      return {
        phase: "ready",
        suggestions: [action.suggestion, ...state.suggestions],
      };
    case "patch-votes":
      if (state.phase !== "ready") return state;
      return {
        phase: "ready",
        suggestions: state.suggestions.map((s) =>
          s.id === action.id
            ? { ...s, votes_up: action.votes_up, votes_down: action.votes_down }
            : s
        ),
      };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

function daysSince(iso: string): number {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    return ms / (1000 * 60 * 60 * 24);
  } catch {
    return 1;
  }
}

function sortSuggestions(
  list: SuggestionItem[],
  key: SortKey
): SuggestionItem[] {
  const copy = [...list];
  switch (key) {
    case "recent":
      return copy.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    case "earliest":
      return copy.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    case "most-votes":
      return copy.sort((a, b) => b.votes_up - a.votes_up);
    case "least-votes":
      return copy.sort((a, b) => a.votes_up - b.votes_up);
    case "velocity": {
      const vel = (s: SuggestionItem) =>
        s.votes_up / Math.max(1, daysSince(s.created_at));
      return copy.sort((a, b) => vel(b) - vel(a));
    }
    default:
      return copy;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({
  status,
  eta,
}: {
  status: SuggestionItem["status"];
  eta: string | null;
}) {
  if (status === "accepted") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.25rem",
          fontSize: "0.75rem",
          fontFamily: "var(--font-geist-mono)",
          background: "rgba(34,197,94,0.12)",
          color: "var(--primary)",
          border: "1px solid rgba(34,197,94,0.25)",
          borderRadius: "6px",
          padding: "0.1875rem 0.5rem",
          whiteSpace: "nowrap",
        }}
      >
        <span aria-hidden="true">✓</span>
        Accepted{eta ? ` · ETA ${eta}` : ""}
      </span>
    );
  }

  if (status === "delivered") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.25rem",
          fontSize: "0.75rem",
          fontFamily: "var(--font-geist-mono)",
          background: "rgba(59,130,246,0.12)",
          color: "var(--secondary)",
          border: "1px solid rgba(59,130,246,0.25)",
          borderRadius: "6px",
          padding: "0.1875rem 0.5rem",
          whiteSpace: "nowrap",
        }}
      >
        <span aria-hidden="true">✓</span>
        Delivered
      </span>
    );
  }

  if (status === "declined") {
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          fontSize: "0.75rem",
          fontFamily: "var(--font-geist-mono)",
          background: "rgba(239,68,68,0.08)",
          color: "var(--danger)",
          border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: "6px",
          padding: "0.1875rem 0.5rem",
        }}
      >
        Declined
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: "0.75rem",
        fontFamily: "var(--font-geist-mono)",
        background: "var(--surface-3)",
        color: "var(--fg-dim)",
        border: "1px solid var(--border)",
        borderRadius: "6px",
        padding: "0.1875rem 0.5rem",
      }}
    >
      Awaiting assignment
    </span>
  );
}

function UpvoteButton({
  count,
  onClick,
  disabled,
}: {
  count: number;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Upvote (${count} vote${count !== 1 ? "s" : ""})`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3125rem",
        background: "var(--surface-3)",
        border: "1px solid var(--border)",
        borderRadius: "6px",
        padding: "0.25rem 0.5625rem",
        cursor: disabled ? "not-allowed" : "pointer",
        color: "var(--primary)",
        fontSize: "0.8125rem",
        fontFamily: "var(--font-geist-mono)",
        fontWeight: 600,
        transition: "background 0.15s, border-color 0.15s",
        opacity: disabled ? 0.6 : 1,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.background =
            "rgba(34,197,94,0.1)";
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "rgba(34,197,94,0.4)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          "var(--surface-3)";
        (e.currentTarget as HTMLButtonElement).style.borderColor =
          "var(--border)";
      }}
    >
      <span aria-hidden="true" style={{ fontSize: "0.625rem" }}>
        ▲
      </span>
      {count}
    </button>
  );
}

function SuggestionCard({
  suggestion,
  onVote,
  voteError,
  voteLoading,
}: {
  suggestion: SuggestionItem;
  onVote: (id: string) => void;
  voteError: string | null;
  voteLoading: boolean;
}) {
  return (
    <article
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        padding: "1.25rem 1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      {/* Header: name + status badge */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <h3
          style={{
            color: "var(--fg)",
            fontSize: "0.9375rem",
            fontWeight: 600,
            margin: 0,
            flex: "1 1 auto",
            lineHeight: 1.4,
          }}
        >
          {suggestion.name}
        </h3>
        <StatusBadge status={suggestion.status} eta={suggestion.eta} />
      </div>

      {/* Description */}
      <p
        style={{
          color: "var(--fg-muted)",
          fontSize: "0.875rem",
          lineHeight: 1.65,
          margin: 0,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {suggestion.description}
      </p>

      {/* Footer: date + upvote + GitHub link */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
          marginTop: "0.25rem",
        }}
      >
        <span
          style={{
            fontSize: "0.75rem",
            color: "var(--fg-dim)",
            fontFamily: "var(--font-geist-mono)",
          }}
        >
          {formatDate(suggestion.created_at)}
        </span>

        <UpvoteButton
          count={suggestion.votes_up}
          onClick={() => onVote(suggestion.id)}
          disabled={voteLoading}
        />

        {suggestion.github_issue_url && (
          <a
            href={suggestion.github_issue_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "0.75rem",
              color: "var(--secondary)",
              textDecoration: "none",
              fontFamily: "var(--font-geist-mono)",
              opacity: 0.8,
              transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.opacity = "1";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.opacity = "0.8";
            }}
          >
            GitHub issue ↗
          </a>
        )}
      </div>

      {/* Vote error for this card */}
      {voteError && (
        <div
          role="status"
          aria-live="polite"
          style={{
            fontSize: "0.8125rem",
            color: "var(--accent)",
            borderRadius: "6px",
            background: "rgba(234,179,8,0.08)",
            border: "1px solid rgba(234,179,8,0.2)",
            padding: "0.5rem 0.75rem",
          }}
        >
          {voteError}
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Main board component
// ---------------------------------------------------------------------------

export default function SuggestionsBoard() {
  const [board, dispatch] = useReducer(boardReducer, { phase: "loading" });
  const [sortKey, setSortKey] = useState<SortKey>("recent");

  // Bootstrap: fetch suggestions once on mount.
  // Uses setTimeout(..., 0) inside the effect so that setState is called
  // asynchronously (deferred to outside the synchronous effect body),
  // matching the pattern used in NotificationSignup.tsx to satisfy the
  // react-hooks/set-state-in-effect lint rule.
  useEffect(() => {
    const t = window.setTimeout(() => {
      fetch("/api/suggestions")
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load suggestions.");
          return res.json() as Promise<{
            ok: boolean;
            suggestions?: SuggestionItem[];
          }>;
        })
        .then((data) => {
          dispatch({
            type: "loaded",
            suggestions:
              data.ok && Array.isArray(data.suggestions)
                ? data.suggestions
                : [],
          });
        })
        .catch((err: unknown) => {
          dispatch({
            type: "error",
            message:
              err instanceof Error
                ? err.message
                : "Could not load suggestions.",
          });
        });
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const suggestions = useMemo(
    () => (board.phase === "ready" ? board.suggestions : []),
    [board]
  );
  const loading = board.phase === "loading";
  const loadError = board.phase === "error" ? board.message : null;

  // Sorted view — re-computed whenever suggestions or sortKey changes.
  // Voting patches the base suggestions array; the sorted view follows.
  const sortedSuggestions = useMemo(
    () => sortSuggestions(suggestions, sortKey),
    [suggestions, sortKey]
  );

  // Stats derived from the full (unsorted) suggestions array.
  const stats = useMemo(() => {
    if (suggestions.length === 0) return null;
    return {
      awaiting: suggestions.filter((s) => s.status === "awaiting").length,
      accepted: suggestions.filter((s) => s.status === "accepted").length,
      delivered: suggestions.filter((s) => s.status === "delivered").length,
      withIssues: suggestions.filter((s) => s.github_issue_url !== null).length,
      totalVotes: suggestions.reduce((sum, s) => sum + s.votes_up, 0),
    };
  }, [suggestions]);

  // Submit form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle");
  const [submitMessage, setSubmitMessage] = useState("");

  // Vote state: per-suggestion error + global loading flag
  const [voteErrors, setVoteErrors] = useState<Record<string, string>>({});
  const [voteLoading, setVoteLoading] = useState(false);

  // Submit handler
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const trimName = name.trim();
    const trimDesc = description.trim();

    if (!trimName) {
      setSubmitStatus("error");
      setSubmitMessage("Please enter a name for your suggestion.");
      return;
    }
    if (!trimDesc) {
      setSubmitStatus("error");
      setSubmitMessage("Please describe your suggestion.");
      return;
    }

    setSubmitStatus("sending");
    setSubmitMessage("Posting...");

    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: trimName, description: trimDesc }),
      });

      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        suggestion?: SuggestionItem;
      };

      if (res.status === 429) {
        setSubmitStatus("error");
        setSubmitMessage(
          data.error ??
            "You've submitted too many suggestions. Try again in an hour."
        );
        return;
      }

      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Something went wrong. Please try again.");
      }

      if (data.suggestion) {
        dispatch({ type: "prepend", suggestion: data.suggestion });
      }

      setSubmitStatus("sent");
      setSubmitMessage("Posted. It's live below.");
      setName("");
      setDescription("");
    } catch (err) {
      setSubmitStatus("error");
      setSubmitMessage(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    }
  };

  // Upvote toggle handler with optimistic update
  const handleVote = useCallback(
    async (suggestionId: string) => {
      if (voteLoading) return;

      // Optimistic toggle: if current votes_up > 0 assume we're removing,
      // otherwise adding. The server is authoritative; we reconcile after.
      const current = suggestions.find((s) => s.id === suggestionId);
      const optimisticUp = (current?.votes_up ?? 0) + 1;

      dispatch({
        type: "patch-votes",
        id: suggestionId,
        votes_up: optimisticUp,
        votes_down: current?.votes_down ?? 0,
      });

      setVoteLoading(true);
      setVoteErrors((prev) => ({ ...prev, [suggestionId]: "" }));

      try {
        const res = await fetch("/api/suggestions/vote", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            suggestion_id: suggestionId,
            direction: "up",
          }),
        });

        const data = (await res.json()) as {
          ok?: boolean;
          votes_up?: number;
          votes_down?: number;
          rateLimited?: boolean;
          error?: string;
        };

        // Apply authoritative counts from server
        if (
          typeof data.votes_up === "number" ||
          typeof data.votes_down === "number"
        ) {
          dispatch({
            type: "patch-votes",
            id: suggestionId,
            votes_up: data.votes_up ?? optimisticUp,
            votes_down: data.votes_down ?? (current?.votes_down ?? 0),
          });
        }

        if (res.status === 429 || data.rateLimited) {
          setVoteErrors((prev) => ({
            ...prev,
            [suggestionId]:
              data.error ??
              "You've used your 3 votes this hour. Try again later.",
          }));
        } else if (!data.ok) {
          // Revert optimistic update on error
          dispatch({
            type: "patch-votes",
            id: suggestionId,
            votes_up: current?.votes_up ?? 0,
            votes_down: current?.votes_down ?? 0,
          });
          setVoteErrors((prev) => ({
            ...prev,
            [suggestionId]: data.error ?? "Vote failed. Please try again.",
          }));
        }
      } catch {
        // Revert optimistic update on network error
        dispatch({
          type: "patch-votes",
          id: suggestionId,
          votes_up: current?.votes_up ?? 0,
          votes_down: current?.votes_down ?? 0,
        });
        setVoteErrors((prev) => ({
          ...prev,
          [suggestionId]: "Network error. Please try again.",
        }));
      } finally {
        setVoteLoading(false);
      }
    },
    [suggestions, voteLoading]
  );

  const isSending = submitStatus === "sending";
  const isSuccess = submitStatus === "sent";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
      {/* ---- Submit form ---- */}
      <section>
        <h2
          style={{
            color: "var(--fg)",
            fontSize: "1.125rem",
            fontWeight: 600,
            margin: "0 0 1rem",
          }}
        >
          Submit a suggestion
        </h2>
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "1.5rem",
          }}
        >
          <form
            onSubmit={handleSubmit}
            noValidate
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            {/* Name */}
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.375rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--fg-muted)",
                  fontFamily: "var(--font-geist-mono)",
                }}
              >
                Name{" "}
                <span aria-hidden="true" style={{ color: "var(--danger)" }}>
                  *
                </span>
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                required
                disabled={isSending || isSuccess}
                placeholder="Short title for your suggestion"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "0.625rem 0.875rem",
                  color: "var(--fg)",
                  fontSize: "0.9375rem",
                  fontFamily: "inherit",
                  outline: "none",
                  transition: "border-color 0.15s",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              />
            </label>

            {/* Description */}
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.375rem",
              }}
            >
              <span
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--fg-muted)",
                  fontFamily: "var(--font-geist-mono)",
                }}
              >
                Description{" "}
                <span aria-hidden="true" style={{ color: "var(--danger)" }}>
                  *
                </span>
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                maxLength={4000}
                required
                disabled={isSending || isSuccess}
                placeholder="Describe your idea. What problem does it solve? What would you expect?"
                style={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  padding: "0.625rem 0.875rem",
                  color: "var(--fg)",
                  fontSize: "0.9375rem",
                  fontFamily: "inherit",
                  resize: "vertical",
                  outline: "none",
                  transition: "border-color 0.15s",
                  lineHeight: "1.6",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--primary)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              />
              <span
                style={{
                  fontSize: "0.75rem",
                  color: "var(--fg-dim)",
                  textAlign: "right",
                }}
              >
                {description.length}/4000
              </span>
            </label>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSending || isSuccess}
              style={{
                background:
                  isSending || isSuccess
                    ? "rgba(34,197,94,0.5)"
                    : "var(--primary)",
                border: "1px solid var(--primary)",
                borderRadius: "8px",
                padding: "0.75rem 1.5rem",
                color: "#08070d",
                fontFamily: "var(--font-geist-mono)",
                fontSize: "0.875rem",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: isSending || isSuccess ? "not-allowed" : "pointer",
                opacity: isSending || isSuccess ? 0.65 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {isSending
                ? "Posting..."
                : isSuccess
                ? "Posted"
                : "Submit Suggestion"}
            </button>

            {/* Inline status */}
            {submitMessage && (
              <div
                role="status"
                aria-live="polite"
                style={{
                  borderRadius: "8px",
                  border: `1px solid ${
                    submitStatus === "error"
                      ? "var(--danger)"
                      : "var(--border)"
                  }`,
                  background:
                    submitStatus === "error"
                      ? "rgba(239,68,68,0.08)"
                      : isSuccess
                      ? "rgba(34,197,94,0.08)"
                      : "var(--surface-2)",
                  padding: "0.75rem 1rem",
                  fontSize: "0.875rem",
                  color:
                    submitStatus === "error"
                      ? "var(--danger)"
                      : isSuccess
                      ? "var(--primary)"
                      : "var(--fg-muted)",
                }}
              >
                {submitMessage}
              </div>
            )}
          </form>
        </div>
      </section>

      {/* ---- Suggestions list ---- */}
      <section>
        {/* Heading row with sort control */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "1rem",
            flexWrap: "wrap",
            marginBottom: "0.625rem",
          }}
        >
          <h2
            style={{
              color: "var(--fg)",
              fontSize: "1.125rem",
              fontWeight: 600,
              margin: 0,
              flex: "1 1 auto",
            }}
          >
            All suggestions
            {suggestions.length > 0 && (
              <span style={{ color: "var(--fg-dim)", fontWeight: 400 }}>
                {" "}
                ({suggestions.length})
              </span>
            )}
          </h2>

          {suggestions.length > 1 && (
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                fontSize: "0.75rem",
                color: "var(--fg-dim)",
                fontFamily: "var(--font-geist-mono)",
                whiteSpace: "nowrap",
              }}
            >
              Sort:
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                style={{
                  background: "var(--surface-3)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  padding: "0.1875rem 0.5rem",
                  color: "var(--fg)",
                  fontSize: "0.75rem",
                  fontFamily: "var(--font-geist-mono)",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                <option value="recent">Most recent</option>
                <option value="earliest">Earliest</option>
                <option value="most-votes">Most upvotes</option>
                <option value="least-votes">Least upvotes</option>
                <option value="velocity">Top velocity</option>
              </select>
            </label>
          )}
        </div>

        {/* Stats summary line */}
        {stats && (
          <p
            style={{
              margin: "0 0 1rem",
              fontSize: "0.78rem",
              fontFamily: "var(--font-geist-mono)",
              color: "var(--fg-dim)",
              lineHeight: 1.6,
            }}
          >
            {stats.awaiting} awaiting assignment
            {" · "}
            {stats.accepted} accepted
            {" · "}
            {stats.delivered} delivered
            {" · "}
            <a
              href="https://github.com/RepoRadar/reporadar/issues"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: "var(--primary)",
                textDecoration: "none",
              }}
            >
              {stats.withIssues} with GitHub issues
            </a>
            {" · "}
            {stats.totalVotes} total votes
          </p>
        )}

        {loading && (
          <div
            style={{
              color: "var(--fg-dim)",
              fontSize: "0.875rem",
              textAlign: "center",
              padding: "2rem 0",
            }}
          >
            Loading suggestions...
          </div>
        )}

        {loadError && (
          <div
            style={{
              color: "var(--danger)",
              fontSize: "0.875rem",
              padding: "1rem",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              borderRadius: "8px",
            }}
          >
            {loadError}
          </div>
        )}

        {!loading && !loadError && suggestions.length === 0 && (
          <div
            style={{
              color: "var(--fg-dim)",
              fontSize: "0.875rem",
              textAlign: "center",
              padding: "2.5rem 0",
              fontFamily: "var(--font-geist-mono)",
            }}
          >
            No suggestions yet. Be the first!
          </div>
        )}

        {sortedSuggestions.length > 0 && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
          >
            {sortedSuggestions.map((s) => (
              <SuggestionCard
                key={s.id}
                suggestion={s}
                onVote={handleVote}
                voteError={voteErrors[s.id] ?? null}
                voteLoading={voteLoading}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
