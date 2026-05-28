"use client";

/**
 * ContactForm — client component that posts to /api/contact.
 *
 * Status state machine: idle | sending | sent | queued | error
 * Inline status box (role="status" aria-live="polite") mirrors FeedbackWidget (D-07).
 * Client-side validation gates the fetch; server validates again.
 */

import { type FormEvent, useState } from "react";

type ContactStatus = "idle" | "sending" | "sent" | "queued" | "error";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<ContactStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const isSuccess = status === "sent" || status === "queued";
  const isBusy = status === "sending";

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Client-side validation
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName) {
      setStatus("error");
      setStatusMessage("Please enter your name.");
      return;
    }
    if (!trimmedEmail || !EMAIL_SHAPE.test(trimmedEmail)) {
      setStatus("error");
      setStatusMessage("Please enter a valid email address.");
      return;
    }
    if (!trimmedMessage) {
      setStatus("error");
      setStatusMessage("Please enter a message.");
      return;
    }

    setStatus("sending");
    setStatusMessage("Sending...");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          message: trimmedMessage,
        }),
      });

      const body = (await res.json()) as {
        ok?: boolean;
        sent?: boolean;
        queued?: boolean;
        error?: string;
      };

      if (res.status === 429) {
        setStatus("error");
        setStatusMessage(body.error ?? "Too many messages, try again shortly.");
        return;
      }

      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? "Something went wrong. Please try again.");
      }

      if (body.queued) {
        setStatus("queued");
        setStatusMessage("Message received. We'll be in touch soon.");
      } else {
        setStatus("sent");
        setStatusMessage("Message sent! We'll get back to you soon.");
      }

      // Clear message on success (name/email kept for convenience)
      setMessage("");
    } catch (err) {
      setStatus("error");
      setStatusMessage(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Name */}
      <label style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <span style={{ fontSize: "0.8125rem", color: "var(--fg-muted)", fontFamily: "var(--font-geist-mono)" }}>
          Name <span aria-hidden="true" style={{ color: "var(--danger)" }}>*</span>
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          required
          autoComplete="name"
          disabled={isBusy || isSuccess}
          placeholder="Your name"
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
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
        />
      </label>

      {/* Email */}
      <label style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <span style={{ fontSize: "0.8125rem", color: "var(--fg-muted)", fontFamily: "var(--font-geist-mono)" }}>
          Email <span aria-hidden="true" style={{ color: "var(--danger)" }}>*</span>
        </span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={200}
          required
          autoComplete="email"
          disabled={isBusy || isSuccess}
          placeholder="you@example.com"
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
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
        />
      </label>

      {/* Message */}
      <label style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
        <span style={{ fontSize: "0.8125rem", color: "var(--fg-muted)", fontFamily: "var(--font-geist-mono)" }}>
          Message <span aria-hidden="true" style={{ color: "var(--danger)" }}>*</span>
        </span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          maxLength={4000}
          required
          disabled={isBusy || isSuccess}
          placeholder="How can we help? Questions, ideas, feedback, anything."
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
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
        />
        <span style={{ fontSize: "0.75rem", color: "var(--fg-dim)", textAlign: "right" }}>
          {message.length}/4000
        </span>
      </label>

      {/* Submit */}
      <button
        type="submit"
        disabled={isBusy || isSuccess}
        style={{
          background: isBusy || isSuccess ? "rgba(34,197,94,0.5)" : "var(--primary)",
          border: "1px solid var(--primary)",
          borderRadius: "8px",
          padding: "0.75rem 1.5rem",
          color: "#08070d",
          fontFamily: "var(--font-geist-mono)",
          fontSize: "0.875rem",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: isBusy || isSuccess ? "not-allowed" : "pointer",
          transition: "opacity 0.15s",
          opacity: isBusy || isSuccess ? 0.65 : 1,
        }}
      >
        {isBusy ? "Sending..." : isSuccess ? "Sent" : "Send Message"}
      </button>

      {/* Inline status box — mirrors FeedbackWidget (D-07) */}
      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          style={{
            borderRadius: "8px",
            border: `1px solid ${status === "error" ? "var(--danger)" : "var(--border)"}`,
            background:
              status === "error"
                ? "rgba(239,68,68,0.08)"
                : isSuccess
                ? "rgba(34,197,94,0.08)"
                : "var(--surface-2)",
            padding: "0.75rem 1rem",
            fontSize: "0.875rem",
            color:
              status === "error"
                ? "var(--danger)"
                : isSuccess
                ? "var(--primary)"
                : "var(--fg-muted)",
          }}
        >
          {statusMessage}
        </div>
      )}
    </form>
  );
}
