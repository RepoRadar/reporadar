# 06 — Workers AI Whisper as a STT fallback for TALK

**Status:** Roadmap · **Effort:** 1 day · **Depends on:** Nothing

## What

When the user clicks TALK in a browser that doesn't support `SpeechRecognition` (Safari, Firefox on some platforms, mobile WebView), record audio with `MediaRecorder` and POST it to a `/api/talk/stt` route that runs Cloudflare Workers AI's Whisper model. Return the transcript.

Today: TALK falls back to a `"Voice input isn't supported in this browser. Try Chrome on desktop, or type your query below."` error message.

## Why

The current TALK panel only works in Chromium-based browsers on desktop. That means:

- ~30% of judges using Safari on Mac get the fallback error.
- iOS Safari (most likely device for a quick demo lookup) gets the fallback error.
- Firefox users get the fallback error.

The voice demo beat is one of RepoRadar's most striking. Losing it on a third of devices is a real demo-quality hit.

Whisper-via-Workers-AI is a one-day add that brings TALK to every browser that can record audio (which is essentially all of them post-2024).

## How (sketch)

### Client (TalkPanel.tsx)

Detect `SpeechRecognition` support. If absent, fall back to the MediaRecorder path:

```ts
async function recordViaMediaRecorder(): Promise<string> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
  const chunks: Blob[] = [];

  recorder.ondataavailable = (e) => chunks.push(e.data);
  recorder.start();

  // ... show "Listening… tap to stop" UI ...
  await waitForUserStop();
  recorder.stop();
  stream.getTracks().forEach((t) => t.stop());

  const audioBlob = new Blob(chunks, { type: "audio/webm" });
  const res = await fetch("/api/talk/stt", {
    method: "POST",
    headers: { "Content-Type": "audio/webm" },
    body: audioBlob,
  });
  const { transcript } = await res.json();
  return transcript;
}
```

### Server (`app/api/talk/stt/route.ts`)

```ts
export const runtime = "edge"; // Whisper is a Workers AI binding

export async function POST(req: NextRequest) {
  const audio = await req.arrayBuffer();
  const result = await env.AI.run("@cf/openai/whisper", {
    audio: [...new Uint8Array(audio)],
  });
  return NextResponse.json({ transcript: result.text });
}
```

The `env.AI` binding requires `[ai]` in `wrangler.jsonc` — already supported by OpenNext for Cloudflare in v3+.

### UX wrinkles

- **Recording stop UX.** Web Speech API auto-stops on silence; MediaRecorder doesn't. Need explicit "tap to stop" + a 30s max timer.
- **Latency.** Whisper inference is 1–3s for short clips. Add an intermediate "transcribing…" state between record-stop and the agent ack.
- **Permission persistence.** First-time mic permission prompt fires the same way in both code paths. Subsequent uses are cached by the browser.

## Effort breakdown

| Step | Time |
|---|---|
| `/api/talk/stt` route + AI binding wiring | 1 h |
| MediaRecorder client path with stop-button UX | 3 h |
| Detection + fallback branching in TalkPanel | 1 h |
| Transcribing-state UI + timeout | 1 h |
| Cross-browser smoke test (Safari Mac + iOS + Firefox) | 2 h |
| **Total** | **~1 day** |

## What success looks like

- TALK works end-to-end on iOS Safari (the most-likely judge phone)
- TALK works on macOS Safari
- TALK works on Firefox
- Transcription quality matches Web Speech API for short English phrases
- Latency stays under 4s end-to-end for a typical short query

## Open questions

1. **Multi-language transcription.** Whisper handles ~99 languages natively. Web Speech is more limited. This is a small upside for international judges.
2. **Cost.** Workers AI Whisper is metered. Per-call cost is in the tenths of a cent. Demo traffic is fine; v1.0 traffic might warrant a daily cap per IP.
3. **Streaming.** Web Speech streams interim transcripts; Whisper doesn't. The MediaRecorder path is "record fully, then transcribe", which feels slower even if total latency is comparable. Worth showing a slightly different "Recording 3s… 4s… 5s…" indicator so users know the system hasn't hung.
4. **Defaulting.** Once the fallback exists, do we always prefer Web Speech (lower latency, streaming) when available? Probably yes — keep the Whisper path for explicit no-SpeechRecognition cases.
