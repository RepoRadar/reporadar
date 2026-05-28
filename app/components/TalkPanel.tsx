"use client";

import { useEffect, useRef, useState } from "react";
import { parseVoiceIntent } from "@/app/lib/parseVoiceIntent";

type TalkState = "idle" | "greeting" | "listening" | "thinking" | "speaking" | "error";

// Conversational greeting variety. First-turn greetings open the conversation;
// follow-up greetings ride on top of an existing search so the user feels
// like they're refining, not starting over.
const FIRST_TURN_GREETINGS: string[] = [
  "Hey - what are you looking for?",
  "How can I help?",
  "What's on your mind?",
  "What are you looking to achieve?",
  "Hey - what kind of repo do you need?",
  "Hi - what would you like to find?",
  "What can I dig up for you?",
];

const FOLLOWUP_GREETINGS: string[] = [
  "What else can I help with?",
  "How would you like to refine this?",
  "Want to look for something different?",
  "Want to narrow that down?",
  "Anything else you'd like to find?",
  "What direction next?",
  "Want me to filter this further?",
];

function pickGreeting(turnIndex: number): string {
  const pool = turnIndex === 0 ? FIRST_TURN_GREETINGS : FOLLOWUP_GREETINGS;
  return pool[Math.floor(Math.random() * pool.length)];
}

// In-browser voice loop:
//   1. mount → 11Labs TTS greets via /api/talk/tts (Archer voice)
//   2. user clicks mic → Web Speech API captures → final transcript
//   3. transcript → parseVoiceIntent → {topic, query}
//   4. agent acks (TTS) what it understood, then onSubmit fires runQuery
//      with the parsed intent so the card grid re-ranks
//
// Without ELEVENLABS_API_KEY the panel still works: greeting + ack go silent,
// mic still captures + transcribes + submits. Without SpeechRecognition the
// user sees a clear "voice not supported" message.
export function TalkPanel({
  turnIndex,
  onSubmit,
  onClose,
}: {
  turnIndex: number;
  onSubmit: (intent: { topic?: string; query?: string; label: string }) => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<TalkState>("idle");
  const [transcript, setTranscript] = useState("");
  // Initialize to a stable placeholder so SSR + first client paint match;
  // the real (randomized) greeting is set in the mount effect below.
  const [agentSay, setAgentSay] = useState<string>(
    turnIndex === 0 ? FIRST_TURN_GREETINGS[0] : FOLLOWUP_GREETINGS[0],
  );
  const [error, setError] = useState<string | null>(null);
  const recogRef = useRef<unknown>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const speak = async (text: string, onComplete?: () => void) => {
    if (!text) {
      onComplete?.();
      return;
    }
    try {
      setState("speaking");
      const res = await fetch("/api/talk/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`tts ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;
      audio.src = url;
      await audio.play();
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setState("idle");
        onComplete?.();
      };
    } catch {
      // Voice is best-effort — if TTS fails we still show the text and continue.
      setState("idle");
      onComplete?.();
    }
  };

  // Speak the greeting once when the panel mounts, then auto-start the mic
  // so the user can just talk without having to tap a second button. The
  // browser will surface the mic-permission prompt the first time; once
  // granted it stays granted for the session.
  useEffect(() => {
    const greeting = pickGreeting(turnIndex);
    setAgentSay(greeting);
    setState("greeting");
    speak(greeting, () => {
      startListening();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startListening = () => {
    setError(null);
    type SpeechRecognitionEventLike = {
      results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>;
    };
    type SpeechRecognitionLike = {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      onresult: ((e: SpeechRecognitionEventLike) => void) | null;
      onend: (() => void) | null;
      onerror: ((e: { error?: string }) => void) | null;
      start: () => void;
      stop: () => void;
    };
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      setError(
        "Voice input isn't supported in this browser. Try Chrome on desktop, or type your query below.",
      );
      return;
    }
    const recog = new SR();
    recog.lang = "en-US";
    recog.continuous = false;
    recog.interimResults = true;
    let finalText = "";
    recog.onresult = (e) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setTranscript(finalText || interim);
    };
    recog.onerror = (e) => {
      setError(e.error ?? "Voice input failed. Try again or type instead.");
      setState("idle");
    };
    recog.onend = () => {
      if (finalText.trim()) {
        handleQuery(finalText.trim());
      } else {
        setState("idle");
      }
    };
    recogRef.current = recog;
    setState("listening");
    recog.start();
  };

  const stopListening = () => {
    const r = recogRef.current as { stop?: () => void } | null;
    r?.stop?.();
  };

  const handleQuery = async (q: string) => {
    setState("thinking");
    const intent = parseVoiceIntent(q);
    // Confirm what was understood so the user knows we heard them right.
    // If the topic matched, name it; otherwise fall back to the generic ack.
    const ack = intent.topic
      ? `Looking up ${intent.topic.replace(/-/g, " ")} repos for you.`
      : intent.query
        ? `Searching for ${intent.query}.`
        : "Yeah, let me look those up for you.";
    setAgentSay(ack);
    speak(ack);
    const labelBits: string[] = [];
    if (intent.topic) labelBits.push(intent.topic);
    if (intent.query) labelBits.push(`"${intent.query}"`);
    const label = labelBits.length ? `voice: ${labelBits.join(" + ")}` : `voice: ${q}`;
    onSubmit({ topic: intent.topic, query: intent.query, label });
  };

  return (
    <div
      id="panel-talk"
      role="dialog"
      aria-label="Talk to RepoRadar"
      className="border-t px-6 py-5"
      style={{
        borderColor: "var(--border)",
        background: "linear-gradient(180deg, rgba(34,197,94,0.04) 0%, transparent 100%)",
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--fg-dim)" }}>
          Talk to RepoRadar
        </p>
        <button
          onClick={() => {
            stopListening();
            onClose();
          }}
          aria-label="Close"
          className="text-[11px] font-mono transition hover:underline"
          style={{ color: "var(--fg-dim)" }}
        >
          close ✕
        </button>
      </div>

      <div className="flex flex-col items-center gap-4 py-4">
        <p
          className="max-w-2xl text-center text-base leading-relaxed"
          style={{ color: "var(--fg)" }}
        >
          {agentSay}
        </p>

        <button
          onClick={state === "listening" ? stopListening : startListening}
          disabled={state === "speaking" || state === "thinking"}
          aria-pressed={state === "listening"}
          className="flex items-center gap-3 rounded-full border-2 px-6 py-3 text-[13px] font-mono font-semibold uppercase tracking-[0.18em] transition disabled:opacity-50"
          style={{
            borderColor: state === "listening" ? "var(--primary)" : "var(--border-strong)",
            background:
              state === "listening" ? "rgba(34,197,94,0.15)" : "var(--surface-2)",
            color: state === "listening" ? "var(--primary)" : "var(--fg-muted)",
            boxShadow: state === "listening" ? "0 0 24px var(--primary-glow)" : "none",
          }}
        >
          <span
            aria-hidden
            className={`inline-block h-3 w-3 rounded-full ${state === "listening" ? "animate-pulse" : ""}`}
            style={{
              background: state === "listening" ? "var(--primary)" : "var(--border-strong)",
              boxShadow: state === "listening" ? "0 0 12px var(--primary-glow)" : "none",
            }}
          />
          {state === "listening" ? "Listening… tap to stop" : "Tap to talk"}
        </button>

        {transcript && (
          <div
            className="w-full max-w-2xl rounded-md border px-4 py-3 text-sm"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface-2)",
              color: "var(--fg-muted)",
            }}
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--fg-dim)" }}>
              You said:
            </span>{" "}
            {transcript}
          </div>
        )}

        {error && (
          <p className="max-w-2xl text-center text-[12px]" style={{ color: "var(--accent-warn, #f87171)" }}>
            {error}
          </p>
        )}

        <p className="text-[10px] font-mono uppercase tracking-[0.18em]" style={{ color: "var(--fg-dim)" }}>
          Click TALK again to refine, or close to fine-tune with the widgets on the left
        </p>
      </div>

    </div>
  );
}
