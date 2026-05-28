"use client";

/**
 * ChatClient: streaming chat UI for /chat/[owner]/[repo].
 *
 * Streams from /api/repo-chat, renders assistant replies with react-markdown.
 * Messages live only in React state (no persistence APIs of any kind).
 * Privacy posture (INTL-04): ephemeral by design, gone on tab close.
 *
 * Chip-2 gate: "I'm building something, does this fit?" does NOT send on click.
 * It opens an inline describe-your-build form; the message is only sent after the
 * user submits a non-empty description.
 */

import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Role = "user" | "assistant";

interface Message {
  role: Role;
  content: string;
}

type ChatStatus = "idle" | "streaming" | "rate-limited" | "error";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChatClientProps {
  fullName: string;
  repoName: string;
  apiKeyPresent: boolean;
}

// ---------------------------------------------------------------------------
// Markdown components (compact, per UI-SPEC §Message list)
// ---------------------------------------------------------------------------

const mdComponents: Components = {
  h1: ({ children }) => (
    <h1
      style={{
        fontSize: "1rem",
        fontWeight: 600,
        color: "var(--fg)",
        margin: "0.75rem 0 0.25rem",
      }}
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      style={{
        fontSize: "1rem",
        fontWeight: 600,
        color: "var(--fg)",
        margin: "0.75rem 0 0.25rem",
      }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      style={{
        fontSize: "1rem",
        fontWeight: 600,
        color: "var(--fg)",
        margin: "0.5rem 0 0.25rem",
      }}
    >
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p
      style={{
        fontSize: "0.875rem",
        lineHeight: 1.65,
        margin: "0 0 0.5rem",
        color: "inherit",
      }}
    >
      {children}
    </p>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        color: "var(--secondary)",
        textDecoration: "underline",
        textUnderlineOffset: "2px",
      }}
    >
      {children}
    </a>
  ),
  code: ({ children, className }) => {
    const isBlock = Boolean(className);
    if (isBlock) {
      return (
        <code
          style={{
            fontFamily: "var(--font-geist-mono)",
            fontSize: "0.8125rem",
            color: "var(--primary)",
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
          fontSize: "0.8125em",
          background: "var(--surface-3)",
          color: "var(--primary)",
          padding: "1px 4px",
          borderRadius: "4px",
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
        margin: "0.5rem 0",
        fontFamily: "var(--font-geist-mono)",
        fontSize: "0.8125rem",
        lineHeight: 1.5,
      }}
    >
      {children}
    </pre>
  ),
  ul: ({ children }) => (
    <ul style={{ paddingLeft: "20px", margin: "0 0 0.5rem", display: "flex", flexDirection: "column", gap: "2px" }}>
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol style={{ paddingLeft: "20px", margin: "0 0 0.5rem", display: "flex", flexDirection: "column", gap: "2px" }}>
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li style={{ fontSize: "0.875rem", lineHeight: 1.55 }}>{children}</li>
  ),
  strong: ({ children }) => (
    <strong style={{ fontWeight: 600 }}>{children}</strong>
  ),
};

// ---------------------------------------------------------------------------
// Chip definitions
// ---------------------------------------------------------------------------

const CHIP_1 = "Why did you score it this way?";
const CHIP_2 = "I'm building something, does this fit?";
const CHIP_3 = "Tell me what's so special about this repo.";
const CHIP_4 = "This sounds like hype. Explain what I'm missing.";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ChatClient({
  fullName,
  repoName,
  apiKeyPresent,
}: ChatClientProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [input, setInput] = useState("");
  const [gateOpen, setGateOpen] = useState(false);
  const [gateText, setGateText] = useState("");
  const [gateBorderFlash, setGateBorderFlash] = useState(false);
  const [showRateLimitBanner, setShowRateLimitBanner] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const msgListRef = useRef<HTMLDivElement>(null);
  const gateTextareaRef = useRef<HTMLTextAreaElement>(null);
  const rateLimitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isStreaming = status === "streaming";
  const inputTrimmed = input.trim();
  const inputOverCap = input.length > 2000;
  const showCharCount = input.length > 1800;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (msgListRef.current) {
      msgListRef.current.scrollTop = msgListRef.current.scrollHeight;
    }
  }, [messages]);

  // Autofocus gate textarea when it opens
  useEffect(() => {
    if (gateOpen && gateTextareaRef.current) {
      gateTextareaRef.current.focus();
    }
  }, [gateOpen]);

  // Clean up rate-limit timer on unmount
  useEffect(() => {
    return () => {
      if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // sendMessage
  // ---------------------------------------------------------------------------

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const controller = new AbortController();
    abortRef.current = controller;

    // Append user message + empty assistant placeholder
    const userMsg: Message = { role: "user", content: trimmed };
    const assistantPlaceholder: Message = { role: "assistant", content: "" };

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setStatus("streaming");

    // Send the last 10 messages (including the new user turn)
    // We build the history from current messages state + the new user turn
    setMessages((prev) => {
      // prev at this point already has the new user msg and placeholder from the setState above
      // We snapshot here for the fetch - using closure capture approach
      return prev;
    });

    // Snapshot messages for fetch (use a ref approach via the queue)
    const historyForFetch = [...messages, userMsg].slice(-10);

    try {
      const res = await fetch("/api/repo-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fullName,
          messages: historyForFetch,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        let errorBody: { ok?: boolean; error?: string } = {};
        try {
          errorBody = (await res.json()) as { ok?: boolean; error?: string };
        } catch {
          // ignore parse failure
        }

        if (res.status === 429) {
          // Remove the empty assistant placeholder
          setMessages((prev) => prev.slice(0, -1));
          setStatus("rate-limited");
          setShowRateLimitBanner(true);
          // Auto-dismiss after 5 seconds
          if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
          rateLimitTimerRef.current = setTimeout(() => {
            setShowRateLimitBanner(false);
            setStatus("idle");
          }, 5000);
          return;
        }

        // Other errors: fill the assistant bubble with the error text
        const errorText = errorBody.error ?? "Something went wrong. Try again.";
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: errorText };
          return updated;
        });
        setStatus("error");
        return;
      }

      // Stream the response body
      if (!res.body) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: "Something went wrong. Try again." };
          return updated;
        });
        setStatus("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last && last.role === "assistant") {
              updated[updated.length - 1] = {
                role: "assistant",
                content: last.content + chunk,
              };
            }
            return updated;
          });
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // User stopped the stream; keep what was received so far
        } else {
          throw err;
        }
      } finally {
        reader.releaseLock();
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // Stop button pressed; keep what was streamed
      } else {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === "assistant" && last.content === "") {
            updated[updated.length - 1] = {
              role: "assistant",
              content: "Something went wrong. Try again.",
            };
          }
          return updated;
        });
        setStatus("error");
        return;
      }
    } finally {
      setStatus("idle");
    }
  }

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  function handleSend() {
    if (isStreaming || inputOverCap || !inputTrimmed) return;
    const text = input;
    setInput("");
    void sendMessage(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  function handleChip1() {
    void sendMessage(CHIP_1);
  }

  function handleChip2Toggle() {
    setGateOpen((prev) => {
      if (prev) {
        // Collapse: reset gate text
        setGateText("");
        setGateBorderFlash(false);
      }
      return !prev;
    });
  }

  function handleChip3() {
    void sendMessage(CHIP_3);
  }

  function handleChip4() {
    void sendMessage(CHIP_4);
  }

  function handleGateSubmit() {
    const trimmed = gateText.trim();
    if (!trimmed) {
      // Flash danger border
      setGateBorderFlash(true);
      setTimeout(() => setGateBorderFlash(false), 600);
      return;
    }
    setGateOpen(false);
    setGateText("");
    void sendMessage(CHIP_2 + "\n" + trimmed);
  }

  function handleGateKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleGateSubmit();
    }
  }

  function dismissRateLimitBanner() {
    setShowRateLimitBanner(false);
    if (status === "rate-limited") setStatus("idle");
    if (rateLimitTimerRef.current) clearTimeout(rateLimitTimerRef.current);
  }

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const showChips = messages.length === 0;
  const lastMsg = messages[messages.length - 1];
  const isTyping = isStreaming && lastMsg?.role === "assistant" && lastMsg.content === "";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        gap: 0,
      }}
    >
      {/* Message list */}
      <div
        ref={msgListRef}
        tabIndex={0}
        aria-label="Conversation"
        aria-live="polite"
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          padding: "4px 0 16px 0",
          minHeight: 0,
        }}
      >
        {/* Suggested prompt chips (shown when thread is empty) */}
        {showChips && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span
              style={{
                fontSize: "0.625rem",
                fontFamily: "var(--font-geist-mono)",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "var(--fg-dim)",
              }}
            >
              Suggestions
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {/* Chip 1 */}
              <ChipButton
                label={CHIP_1}
                onClick={handleChip1}
                disabled={isStreaming}
              />

              {/* Chip 2: gate toggle */}
              <button
                type="button"
                aria-expanded={gateOpen}
                disabled={isStreaming}
                onClick={handleChip2Toggle}
                style={{
                  border: `1px solid ${gateOpen ? "var(--primary)" : "var(--border)"}`,
                  background: gateOpen
                    ? "rgba(34,197,94,0.12)"
                    : "var(--surface-3)",
                  color: gateOpen ? "var(--primary)" : "var(--fg-muted)",
                  borderRadius: "8px",
                  padding: "8px 12px",
                  fontSize: "0.875rem",
                  fontFamily: "var(--font-geist-mono)",
                  minHeight: "44px",
                  cursor: isStreaming ? "not-allowed" : "pointer",
                  opacity: isStreaming ? 0.5 : 1,
                  transition: "border-color 0.15s, background 0.15s, color 0.15s",
                  textAlign: "left",
                  lineHeight: 1.4,
                }}
                onMouseEnter={(e) => {
                  if (!isStreaming && !gateOpen) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--primary)";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--primary)";
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,197,94,0.08)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!gateOpen) {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
                    (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-muted)";
                    (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-3)";
                  }
                }}
              >
                {CHIP_2}
              </button>

              {/* Chip 3 */}
              <ChipButton
                label={CHIP_3}
                onClick={handleChip3}
                disabled={isStreaming}
              />

              {/* Chip 4 */}
              <ChipButton
                label={CHIP_4}
                onClick={handleChip4}
                disabled={isStreaming}
              />
            </div>

            {/* Chip 2 gate inline form */}
            <div
              style={{
                overflow: "hidden",
                maxHeight: gateOpen ? "200px" : "0px",
                transition: "max-height 0.2s ease-out",
              }}
            >
              {gateOpen && (
                <div
                  style={{
                    paddingTop: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <label
                    style={{
                      fontSize: "0.75rem",
                      fontFamily: "var(--font-geist-mono)",
                      color: "var(--fg-muted)",
                    }}
                  >
                    What are you building?
                  </label>
                  <textarea
                    ref={gateTextareaRef}
                    rows={3}
                    value={gateText}
                    onChange={(e) => setGateText(e.target.value)}
                    onKeyDown={handleGateKeyDown}
                    aria-label="Describe what you are building"
                    placeholder="Describe your project briefly, what it does, how it works, what it needs to connect to."
                    style={{
                      background: "var(--surface-2)",
                      border: `1px solid ${gateBorderFlash ? "var(--danger)" : "var(--border)"}`,
                      borderRadius: "8px",
                      padding: "12px",
                      color: "var(--fg)",
                      fontSize: "0.875rem",
                      fontFamily: "inherit",
                      resize: "vertical",
                      outline: "none",
                      minHeight: "72px",
                      transition: "border-color 0.15s",
                      lineHeight: 1.5,
                    }}
                    onFocus={(e) => {
                      if (!gateBorderFlash) {
                        e.currentTarget.style.borderColor = "var(--primary)";
                      }
                    }}
                    onBlur={(e) => {
                      if (!gateBorderFlash) {
                        e.currentTarget.style.borderColor = "var(--border)";
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleGateSubmit}
                    disabled={!gateText.trim()}
                    style={{
                      alignSelf: "flex-start",
                      border: "1px solid var(--primary)",
                      background: "rgba(34,197,94,0.08)",
                      color: "var(--primary)",
                      borderRadius: "8px",
                      padding: "8px 16px",
                      fontSize: "0.8125rem",
                      fontFamily: "var(--font-geist-mono)",
                      fontWeight: 600,
                      cursor: !gateText.trim() ? "not-allowed" : "pointer",
                      opacity: !gateText.trim() ? 0.4 : 1,
                      transition: "background 0.15s, opacity 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      if (gateText.trim()) {
                        (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,197,94,0.20)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,197,94,0.08)";
                    }}
                  >
                    Check the fit
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg, i) => {
          const isUser = msg.role === "user";
          const isLastAssistant =
            !isUser && i === messages.length - 1 && isTyping;

          if (isLastAssistant) {
            // Typing indicator bubble
            return (
              <div
                key={i}
                aria-live="polite"
                aria-label="RepoRadar is thinking"
                style={{
                  alignSelf: "flex-start",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "2px 12px 12px 12px",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  minHeight: "40px",
                }}
              >
                <span
                  className="rr-think-dot"
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "9999px",
                    background: "var(--primary)",
                    display: "inline-block",
                  }}
                />
                <span
                  className="rr-think-dot"
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "9999px",
                    background: "var(--primary)",
                    display: "inline-block",
                  }}
                />
                <span
                  className="rr-think-dot"
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "9999px",
                    background: "var(--primary)",
                    display: "inline-block",
                  }}
                />
                {/* Reduced-motion fallback: static text */}
                <span
                  className="rr-think-static"
                  style={{
                    fontSize: "0.75rem",
                    fontFamily: "var(--font-geist-mono)",
                    color: "var(--fg-dim)",
                    display: "none",
                  }}
                >
                  Thinking...
                </span>
              </div>
            );
          }

          if (isUser) {
            return (
              <div
                key={i}
                style={{
                  alignSelf: "flex-end",
                  background: "var(--surface-3)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "12px 12px 2px 12px",
                  padding: "10px 14px",
                  maxWidth: "85%",
                  fontSize: "0.875rem",
                  color: "var(--fg)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {msg.content}
              </div>
            );
          }

          // Assistant bubble
          return (
            <div
              key={i}
              style={{
                alignSelf: "flex-start",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "2px 12px 12px 12px",
                padding: "10px 14px",
                maxWidth: "100%",
                fontSize: "0.875rem",
                color: "var(--fg)",
                wordBreak: "break-word",
              }}
            >
              <Markdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {msg.content}
              </Markdown>
            </div>
          );
        })}
      </div>

      {/* Rate-limit banner */}
      {showRateLimitBanner && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            fontSize: "0.75rem",
            fontFamily: "var(--font-geist-mono)",
            color: "var(--accent)",
            border: "1px solid var(--accent)",
            background: "rgba(234,179,8,0.08)",
            borderRadius: "8px",
            padding: "8px 12px",
            marginBottom: "8px",
            flexShrink: 0,
          }}
        >
          <span>{"You're sending messages quickly. Give it a few seconds."}</span>
          <button
            type="button"
            onClick={dismissRateLimitBanner}
            aria-label="Dismiss rate limit notice"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--accent)",
              cursor: "pointer",
              fontSize: "1rem",
              padding: "0 2px",
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Composer or unavailable state */}
      {!apiKeyPresent ? (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "16px",
            background: "var(--surface-2)",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: "0.875rem",
              fontFamily: "var(--font-geist-mono)",
              color: "var(--fg-dim)",
            }}
          >
            Chat is not available right now.
          </span>
        </div>
      ) : (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "12px",
            background: "var(--surface-2)",
            padding: "12px 12px 8px 16px",
            flexShrink: 0,
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
          onFocus={(e) => {
            // Focus-within: highlight the outer container
            if (e.currentTarget.contains(e.target)) {
              e.currentTarget.style.borderColor = "var(--primary)";
              e.currentTarget.style.boxShadow = "0 0 0 2px rgba(34,197,94,0.14)";
            }
          }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.boxShadow = "none";
            }
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              placeholder={`Ask anything about ${repoName}...`}
              maxLength={2100}
              style={{
                flex: 1,
                resize: "none",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--fg)",
                fontSize: "0.875rem",
                lineHeight: 1.5,
                minHeight: "44px",
                maxHeight: "calc(6 * 1.5 * 14px + 24px)",
                overflowY: "auto",
                fontFamily: "inherit",
                caretColor: "var(--primary)",
                opacity: isStreaming ? 0.6 : 1,
              }}
              rows={1}
            />

            {/* Send or Stop button */}
            {isStreaming ? (
              <button
                type="button"
                onClick={handleStop}
                aria-label="Stop generating"
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "4px",
                  border: "1px solid var(--danger)",
                  background: "rgba(239,68,68,0.08)",
                  color: "var(--danger)",
                  borderRadius: "6px",
                  padding: "6px 12px",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  fontFamily: "var(--font-geist-mono)",
                  cursor: "pointer",
                  minHeight: "32px",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.20)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.08)";
                }}
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                aria-label="Send message"
                disabled={!inputTrimmed || inputOverCap || isStreaming}
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid var(--primary)",
                  background: "rgba(34,197,94,0.08)",
                  color: "var(--primary)",
                  borderRadius: "6px",
                  padding: "6px 12px",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: !inputTrimmed || inputOverCap ? "not-allowed" : "pointer",
                  opacity: !inputTrimmed || inputOverCap ? 0.4 : 1,
                  minHeight: "32px",
                  transition: "background 0.15s, box-shadow 0.15s, opacity 0.15s",
                }}
                onMouseEnter={(e) => {
                  if (inputTrimmed && !inputOverCap && !isStreaming) {
                    (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,197,94,0.20)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 16px var(--primary-glow)";
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,197,94,0.08)";
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                }}
              >
                {/* Arrow icon */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 16 16"
                  width={14}
                  height={14}
                  fill="currentColor"
                >
                  <path d="M2 8a.75.75 0 0 1 .75-.75h8.69L8.22 4.03a.75.75 0 1 1 1.06-1.06l4.5 4.5a.75.75 0 0 1 0 1.06l-4.5 4.5a.75.75 0 0 1-1.06-1.06l3.22-3.22H2.75A.75.75 0 0 1 2 8Z" />
                </svg>
              </button>
            )}
          </div>

          {/* Character count (shown near cap) */}
          {showCharCount && (
            <div
              style={{
                textAlign: "right",
                fontSize: "0.625rem",
                fontFamily: "var(--font-geist-mono)",
                color: inputOverCap ? "var(--danger)" : "var(--fg-dim)",
                marginTop: "4px",
              }}
            >
              {input.length}/2000
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChipButton helper
// ---------------------------------------------------------------------------

function ChipButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        border: "1px solid var(--border)",
        background: "var(--surface-3)",
        color: "var(--fg-muted)",
        borderRadius: "8px",
        padding: "8px 12px",
        fontSize: "0.875rem",
        fontFamily: "var(--font-geist-mono)",
        minHeight: "44px",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "border-color 0.15s, color 0.15s, background 0.15s",
        textAlign: "left",
        lineHeight: 1.4,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--primary)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--primary)";
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,197,94,0.08)";
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
        (e.currentTarget as HTMLButtonElement).style.color = "var(--fg-muted)";
        (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-3)";
      }}
    >
      {label}
    </button>
  );
}
