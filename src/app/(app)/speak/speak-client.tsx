"use client";

import { useEffect, useRef, useState } from "react";
import { SPEECH_LANG } from "@/lib/speech-lang-map";
import { track } from "@/lib/posthog-client";
import { submitSpeakingAttemptAction, type SubmitSpeakingResult } from "./actions";

// Gamified redesign — Speak Studio recording UI. Same vendor-prefixed
// SpeechRecognition wrapper pattern already used by mic-button.tsx (that
// component itself isn't reused directly since this needs a timed
// recording session + running transcript, not a single toggle-to-fill-a-
// text-field interaction) -- see src/components/mic-button.tsx for the
// original.
interface SpeechRecognitionResultLike {
  [index: number]: { [index: number]: { transcript: string } };
}
interface SpeechRecognitionEventLike {
  results: SpeechRecognitionResultLike;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const PROMPTS = [
  "Расскажи о своих выходных.",
  "Опиши свой обычный день.",
  "Что ты любишь есть на завтрак?",
  "Расскажи о своём любимом фильме.",
  "Какая погода сегодня?",
];
const RECORDING_SECONDS = 30;

type Stage = "ready" | "recording" | "result";

export default function SpeakClient({ targetLanguage }: { targetLanguage: string }) {
  const [supported, setSupported] = useState(true);
  const [stage, setStage] = useState<Stage>("ready");
  const [prompt] = useState(() => PROMPTS[Math.floor(Math.random() * PROMPTS.length)]);
  const [transcript, setTranscript] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(RECORDING_SECONDS);
  const [result, setResult] = useState<SubmitSpeakingResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Same pattern as mic-button.tsx: defer through a timeout instead of
    // calling setState synchronously in the effect body, so this doesn't
    // schedule a cascading re-render right at commit time.
    const timeout = window.setTimeout(() => setSupported(getSpeechRecognitionCtor() !== null), 0);
    return () => {
      window.clearTimeout(timeout);
      recognitionRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function start() {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    setTranscript("");
    setSecondsLeft(RECORDING_SECONDS);
    setStage("recording");
    startedAtRef.current = Date.now();
    track("speak_studio_started", {});

    const recognition = new Ctor();
    recognition.lang = SPEECH_LANG[targetLanguage] ?? "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let combined = "";
      for (let i = 0; i < Object.keys(event.results).length; i++) {
        combined += event.results[i]?.[0]?.transcript ?? "";
      }
      setTranscript(combined);
    };
    recognition.onerror = () => {};
    recognition.onend = () => {};
    recognitionRef.current = recognition;
    recognition.start();

    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          finish();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  function finish() {
    if (timerRef.current) clearInterval(timerRef.current);
    recognitionRef.current?.stop();
    const durationSeconds = Math.round((Date.now() - startedAtRef.current) / 1000);
    setIsSubmitting(true);
    setStage("result");
    submitSpeakingAttemptAction(prompt, transcript, durationSeconds).then((r) => {
      setResult(r);
      setIsSubmitting(false);
      track("speak_studio_completed", { word_count: r.feedback.wordCount, xp_awarded: r.xpAwarded });
    });
  }

  if (!supported) {
    return (
      <div className="rounded-2xl bg-[var(--surface)] p-5 text-center shadow-sm">
        <p className="text-body text-[var(--text-secondary)]">
          Голосовой ввод не поддерживается в этом браузере. Попробуй в Chrome на компьютере.
        </p>
      </div>
    );
  }

  if (stage === "ready") {
    return (
      <div className="rounded-2xl bg-[var(--surface)] p-6 text-center shadow-sm">
        <p className="text-h2 font-bold">{prompt}</p>
        <p className="mt-2 text-body-sm text-[var(--text-secondary)]">У тебя {RECORDING_SECONDS} секунд.</p>
        <button
          type="button"
          onClick={start}
          className="focus-ring mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-primary)] text-2xl text-[var(--color-primary-foreground)]"
          aria-label="Начать говорить"
        >
          🎙️
        </button>
      </div>
    );
  }

  if (stage === "recording") {
    return (
      <div className="rounded-2xl bg-[var(--surface)] p-6 text-center shadow-sm">
        <p className="text-body font-semibold">{prompt}</p>
        <div className="mx-auto mt-5 flex h-16 w-16 animate-pulse items-center justify-center rounded-full bg-[var(--color-danger)] text-2xl text-white">
          🎙️
        </div>
        <p className="mt-3 text-h3 font-bold" aria-live="polite">
          {secondsLeft}с
        </p>
        <p className="mt-3 min-h-[2lh] text-body-sm text-[var(--text-secondary)]">{transcript || "…"}</p>
        <button
          type="button"
          onClick={finish}
          className="focus-ring mt-4 rounded-full border border-[var(--border-strong)] px-5 py-2 text-sm font-semibold"
        >
          Завершить сейчас
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[var(--surface)] p-6 shadow-sm">
      {isSubmitting || !result ? (
        <p className="text-center text-body text-[var(--text-secondary)]">Разбираем ответ…</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-center text-h2 font-bold text-[var(--color-gold-text)]">+{result.xpAwarded} XP</p>
          <div className="rounded-xl bg-[var(--surface-muted)] p-3">
            <p className="text-caption text-[var(--text-secondary)]">Твой ответ</p>
            <p className="mt-1 text-body-sm">{transcript || "(ничего не распознано)"}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-[var(--surface-muted)] p-3">
              <p className="text-h3 font-bold">{result.feedback.wordCount}</p>
              <p className="text-caption text-[var(--text-secondary)]">слов</p>
            </div>
            <div className="rounded-xl bg-[var(--surface-muted)] p-3">
              <p className="text-h3 font-bold">{result.feedback.wordsPerMinute}</p>
              <p className="text-caption text-[var(--text-secondary)]">слов/мин</p>
            </div>
          </div>
          {result.feedback.grammarMatches.length > 0 && (
            <div className="rounded-xl bg-[var(--surface-muted)] p-3">
              <p className="text-caption text-[var(--text-secondary)]">На что обратить внимание</p>
              <ul className="mt-1 flex flex-col gap-1.5">
                {result.feedback.grammarMatches.slice(0, 3).map((m, i) => (
                  <li key={i} className="text-body-sm">
                    {m.explanation} — <span className="text-[var(--color-primary)]">{m.suggestion}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setStage("ready");
              setResult(null);
            }}
            className="focus-ring mt-2 rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-[var(--color-primary-foreground)]"
          >
            Ещё раз
          </button>
        </div>
      )}
    </div>
  );
}
