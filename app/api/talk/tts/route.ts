import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Map of 11Labs voice IDs we shipped on letsgochristo.com/max. Archer is
// the default — deep, considered, "museum curator" energy. Keep this list
// in sync with the picker if we ever expose voice selection in the UI.
const MAX_VOICES: Record<string, string> = {
  L0Dsvb3SLTyegXwtm47J: "Archer",
  UgBBYS2sOqTuMpoF3BR0: "Mark",
  NNl6r8mD7vthiJatiJt1: "Bradford",
  MFZUKuGQUsGJPQjTS4wC: "Jon",
  gs0tAILXbY5DNrJrsM6F: "Jeff",
  BIvP0GN1cAtSRTxNHnWS: "Ellen",
  cgSgspJ2msm6clMCkdW9: "Jessica",
  aMSt68OGf4xUZAnLpTU8: "Juniper",
  "5l5f8iK3YPeGga21rQIX": "Adeline",
  tnSpp4vdxKPjI9w0GnoV: "Hope",
};

const DEFAULT_VOICE_ID = "L0Dsvb3SLTyegXwtm47J"; // Archer
const MAX_CHARS = 1200;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Voice synthesis is not configured." }, { status: 503 });
  }

  let body: { text?: string; voiceId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const text = (body.text || "").trim().slice(0, MAX_CHARS);
  if (!text) return NextResponse.json({ error: "Nothing to speak." }, { status: 400 });

  const voiceId =
    body.voiceId && Object.prototype.hasOwnProperty.call(MAX_VOICES, body.voiceId)
      ? body.voiceId
      : DEFAULT_VOICE_ID;

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.4,
          similarity_boost: 0.8,
          style: 0,
          use_speaker_boost: true,
        },
      }),
    },
  );

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "");
    console.error("ElevenLabs TTS error:", upstream.status, detail.slice(0, 500));
    return NextResponse.json({ error: "Voice synthesis failed." }, { status: 502 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
