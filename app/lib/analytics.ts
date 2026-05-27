/**
 * Provider-agnostic analytics helper (D-12).
 *
 * Call sites pass ONLY safe labels — topic slugs, boolean flags, source counts.
 * No PII (no email, no raw free-text queries). All calls are fire-and-forget.
 *
 * HUMAN HANDOFF — events backend is an open product decision:
 *   Option A: Cloudflare Zaraz  — set up in the CF dashboard; calls window.zaraz.track()
 *   Option B: Plausible Analytics — add plausible("event", { props }) call below
 *   Option C: Umami             — add umami.track("event", props) call below
 * To wire a backend, add ONE call inside the `if (typeof window !== "undefined")` block
 * below and deploy. No call sites need to change.
 *
 * Current state: no-ops in production; console.debug in development.
 *
 * Event name contract (do not rename — these are logged in the analytics dashboard):
 *   "search_run"      — freeform search or topic query via runQuery
 *   "tag_picked"      — tag selected from card chip or header TAGS panel
 *   "deploy_clicked"  — user clicks Deploy in DeployForm
 *   "alert_signup"    — user successfully subscribes in NotificationSignup
 */
export function track(event: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") {
    // Server-side call — no-op safely (should not happen; all call sites are in
    // client components, but guard defensively).
    return;
  }

  if (process.env.NODE_ENV !== "production") {
    // Development: log to console so the team can verify wiring without a backend.
    console.debug("[track]", event, props ?? {});
    return;
  }

  // PRODUCTION: wire your analytics backend here.
  // Example (Cloudflare Zaraz):
  //   try { window.zaraz?.track(event, props); } catch {}
  // Example (Plausible):
  //   try { (window as any).plausible?.(event, { props }); } catch {}
  // Example (Umami):
  //   try { (window as any).umami?.track(event, props); } catch {}
  //
  // Until a backend is chosen this is intentionally a no-op — the beacon covers
  // pageviews; custom events will wire in without touching call sites.
}
