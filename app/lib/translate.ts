import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Repo } from "./types";

// Quick script-detect to skip LLM calls for plain English text.
export function detectLang(s: string | null | undefined): string | null {
  if (!s) return null;
  if (/[一-鿿]/.test(s)) return "Chinese";
  if (/[぀-ゟ゠-ヿ]/.test(s)) return "Japanese";
  if (/[가-힯]/.test(s)) return "Korean";
  if (/[؀-ۿ]/.test(s)) return "Arabic";
  if (/[Ѐ-ӿ]/.test(s)) return "Russian";
  if (/[֐-׿]/.test(s)) return "Hebrew";
  if (/[฀-๿]/.test(s)) return "Thai";
  if (/[ऀ-ॿ]/.test(s)) return "Hindi";
  // For ambiguous Latin-but-not-English (Spanish, French, German, etc.) fall
  // back to non-ASCII char ratio. Most descriptions are short so a low bar
  // (>15% non-ASCII) works well.
  let nonAscii = 0;
  for (const ch of s) {
    if (ch.charCodeAt(0) > 127) nonAscii++;
  }
  if (nonAscii / s.length > 0.15) return "non-English";
  return null;
}

// Process-level translation cache so repeat hits in the same Next.js worker
// don't re-call Gemini. Keyed by raw description.
const translationCache = new Map<string, { lang: string; en: string }>();

type TranslateItem = { idx: number; lang: string; en: string };

/**
 * Mutates the given repos: for each one whose description looks non-English
 * (per detectLang), set descriptionEn + descriptionLang via a single batched
 * Gemini call. No-ops if GOOGLE_API_KEY is missing.
 */
export async function translateRepoDescriptions(repos: Repo[]): Promise<void> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return;

  const candidates: { repo: Repo; lang: string }[] = [];
  for (const r of repos) {
    if (!r.description) continue;
    const cached = translationCache.get(r.description);
    if (cached) {
      r.descriptionLang = cached.lang;
      r.descriptionEn = cached.en;
      continue;
    }
    const lang = detectLang(r.description);
    if (lang) candidates.push({ repo: r, lang });
  }
  if (candidates.length === 0) return;

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      systemInstruction:
        "You translate short GitHub repo descriptions into clean, idiomatic English. Preserve meaning but render it naturally. Detect the source language precisely and name it in full. For Chinese, distinguish 'Traditional Chinese' from 'Simplified Chinese' by the script used. Labels to return look like: 'Traditional Chinese', 'Simplified Chinese', 'Japanese', 'Korean', 'Arabic', 'Russian', 'Hebrew', 'Thai', 'Hindi', 'Spanish', 'French', 'German', 'Portuguese', 'Italian', 'Vietnamese', 'Turkish'. Return ONLY a JSON array.",
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const prompt = `Translate each item to English and detect its source language (for Chinese, specify Traditional Chinese or Simplified Chinese). Return JSON array of {"idx": number, "lang": string, "en": string}.

Items:
${candidates
  .map((c, i) => `${i}. ${c.repo.description}`)
  .join("\n")}`;

    const res = await model.generateContent(prompt);
    const text = res.response.text();
    const items = parseJson(text) as TranslateItem[] | null;
    if (!items || !Array.isArray(items)) return;

    for (const item of items) {
      const c = candidates[item.idx];
      if (!c || !item.en) continue;
      c.repo.descriptionEn = item.en;
      c.repo.descriptionLang = item.lang || c.lang;
      if (c.repo.description) {
        translationCache.set(c.repo.description, {
          lang: c.repo.descriptionLang,
          en: c.repo.descriptionEn,
        });
      }
    }
  } catch (err) {
    console.warn("[translateRepoDescriptions] failed:", err instanceof Error ? err.message : err);
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) {
      try {
        return JSON.parse(m[1]);
      } catch {}
    }
    const first = text.indexOf("[");
    const last = text.lastIndexOf("]");
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(text.slice(first, last + 1));
      } catch {}
    }
    return null;
  }
}
