"use client";

import { useEffect, useRef, useState } from "react";
import { SPEECH_LANG } from "@/lib/speech-lang-map";

// SpeechRecognition — нестандартный, вендор-префиксный API, поэтому его нет
// в стандартных lib.dom.d.ts тайпах TypeScript. Даём здесь только тот
// минимальный набор полей/методов, которые реально используем.
interface SpeechRecognitionResultLike {
  [index: number]: { [index: number]: { transcript: string } };
}
interface SpeechRecognitionEventLike {
  results: SpeechRecognitionResultLike;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
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

// Из разбора конкурента (docs/GROWTH_IDEAS_2026-07-24.md, п.8): бесплатный,
// встроенный в браузер голосовой ввод вместо печати при ручном добавлении
// слова. Поддержка неровная (слабо/никак не работает в части Safari/iOS) —
// поэтому кнопка показывается только когда API реально доступен в браузере.
export default function MicButton({
  lang,
  onResult,
}: {
  lang: string;
  onResult: (text: string) => void;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    // SSR рендерит null (window недоступен) — откладываем проверку через
    // таймаут, а не вызываем setState синхронно в теле эффекта, чтобы не
    // schedule-ить каскадный ре-рендер прямо в момент коммита.
    const timeout = window.setTimeout(() => setSupported(getSpeechRecognitionCtor() !== null), 0);
    return () => {
      window.clearTimeout(timeout);
      recognitionRef.current?.stop();
    };
  }, []);

  function toggle() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = SPEECH_LANG[lang] ?? "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const text = event.results?.[0]?.[0]?.transcript;
      if (text) onResult(text);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={listening ? "Остановить голосовой ввод" : "Голосовой ввод"}
      title={listening ? "Слушаю…" : "Голосовой ввод"}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-base transition-colors ${
        listening
          ? "animate-pulse bg-red-500 text-white"
          : "text-[var(--text-secondary)] hover:text-black dark:hover:text-white"
      }`}
    >
      🎤
    </button>
  );
}
