export type NotificationDigestItem = {
  title: string;
  subtitle: string;
  score: number;
  source: string;
};

export type NotificationSubscription = {
  email: string;
  sources: string[];
  digest: NotificationDigestItem[];
};

export type DummyTrendEmail = {
  subject: string;
  preview: string;
  items: NotificationDigestItem[];
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : null;
}

export function normalizeSources(value: unknown): string[] {
  if (!Array.isArray(value)) return ["RepoRadar"];
  const sources = value
    .filter((source): source is string => typeof source === "string")
    .map((source) => source.trim())
    .filter(Boolean);
  return Array.from(new Set(sources)).slice(0, 4);
}

export function normalizeDigest(value: unknown): NotificationDigestItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const title = typeof record.title === "string" ? record.title.trim() : "";
      if (!title) return null;
      const subtitle = typeof record.subtitle === "string" ? record.subtitle.trim() : "";
      const source = typeof record.source === "string" && record.source.trim()
        ? record.source.trim()
        : "RepoRadar";
      const rawScore = typeof record.score === "number" ? record.score : 0;
      const score = Math.max(0, Math.min(100, Math.round(rawScore)));
      return { title, subtitle, source, score };
    })
    .filter((item): item is NotificationDigestItem => Boolean(item))
    .slice(0, 5);
}

export function buildDummyTrendEmail(subscription: NotificationSubscription): DummyTrendEmail {
  const sourceLabel = subscription.sources.length > 0
    ? subscription.sources.join(" + ")
    : "RepoRadar";
  const items = subscription.digest.length > 0
    ? subscription.digest
    : [
        {
          title: "RepoRadar trend scan",
          subtitle: "Your first digest will use your saved sources and radar settings.",
          score: 80,
          source: "RepoRadar",
        },
      ];

  return {
    subject: `RepoRadar Trend Pulse: ${items[0].title}`,
    preview: `Dummy ${sourceLabel} email queued with ${items.length} trend item${items.length === 1 ? "" : "s"}.`,
    items,
  };
}
