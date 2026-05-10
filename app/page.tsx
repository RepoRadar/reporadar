import { RepoRadarApp } from "@/app/components/RepoRadarApp";

// No caching at the page level. We're iterating on this every few minutes —
// every visit must hit the latest deployed bundle. (Without this, OpenNext +
// Cloudflare were caching the page HTML for s-maxage=31536000 — a year.)
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Home() {
  return <RepoRadarApp />;
}
