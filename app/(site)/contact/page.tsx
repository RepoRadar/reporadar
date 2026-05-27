/**
 * /contact — static page (force-static, (site) route group).
 * The shell and heading are Server-rendered at build time.
 * ContactForm is a client component that hits the API at runtime.
 *
 * D-00: No fetch/fs at the page level — only the client form hits /api/contact.
 */

import type { Metadata } from "next";
import ContactForm from "@/app/(site)/_components/ContactForm";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Contact — RepoRadar",
  description: "Get in touch with the RepoRadar team.",
};

export default function ContactPage() {
  return (
    <>
      <header style={{ marginBottom: "2.5rem" }}>
        <h1
          style={{
            color: "var(--fg)",
            fontSize: "2rem",
            fontWeight: 700,
            lineHeight: 1.2,
            margin: "0 0 0.75rem",
          }}
        >
          Contact
        </h1>
        <p
          style={{
            color: "var(--fg-muted)",
            fontSize: "1rem",
            lineHeight: 1.7,
            margin: 0,
            maxWidth: "520px",
          }}
        >
          Have a question, idea, or just want to say hi? Drop us a message —
          we read every one.
        </p>
      </header>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          padding: "2rem",
        }}
      >
        <ContactForm />
      </div>

      <p
        style={{
          marginTop: "2rem",
          fontSize: "0.8125rem",
          color: "var(--fg-dim)",
          fontFamily: "var(--font-geist-mono)",
        }}
      >
        Prefer GitHub?{" "}
        <a
          href="https://github.com/RepoRadar/reporadar/issues"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "var(--primary)",
            textDecoration: "underline",
            textDecorationColor: "rgba(34,197,94,0.4)",
            textUnderlineOffset: "3px",
          }}
        >
          Open an issue
        </a>{" "}
        — we triage regularly.
      </p>
    </>
  );
}
