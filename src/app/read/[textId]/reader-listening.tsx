"use client";

import { useEffect, useRef, useState } from "react";

function detectSpeechSupport(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// M3 Slice 3: no paid TTS anywhere — browser Web Speech API only, honestly
// labeled (task explicitly forbids calling this "studio narration").
// Tracks the current sentence index so the passage can highlight it.
export function useListening({
  sentences,
  sourceLang,
  onActiveChange,
}: {
  sentences: string[];
  sourceLang: string;
  onActiveChange: (index: number | null) => void;
}) {
  // Lazy initializer (not useEffect+setState) — server and first client
  // render both start from `false` with no hydration mismatch since
  // speechSynthesis never exists during SSR; the real value is computed on
  // the client's first render pass instead of a separate post-mount effect.
  const [supported] = useState(detectSpeechSupport);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const indexRef = useRef(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  function speakFrom(i: number) {
    if (!supported || i >= sentences.length) {
      setPlaying(false);
      onActiveChange(null);
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(sentences[i]);
    utterance.lang = sourceLang;
    utterance.rate = rate;
    utterance.onend = () => {
      indexRef.current = i + 1;
      speakFrom(i + 1);
    };
    utteranceRef.current = utterance;
    indexRef.current = i;
    onActiveChange(i);
    window.speechSynthesis.speak(utterance);
  }

  function play() {
    if (!supported) return;
    setPlaying(true);
    speakFrom(indexRef.current);
  }

  function pause() {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setPlaying(false);
  }

  function stop() {
    if (!supported) return;
    window.speechSynthesis.cancel();
    indexRef.current = 0;
    setPlaying(false);
    onActiveChange(null);
  }

  function togglePlayPause() {
    if (playing) pause();
    else play();
  }

  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { supported, playing, rate, setRate, play, pause, stop, togglePlayPause };
}

export default function ReaderListening({
  supported,
  playing,
  rate,
  onRateChange,
  onPlay,
  onPause,
  onStop,
}: {
  supported: boolean;
  playing: boolean;
  rate: number;
  onRateChange: (rate: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
}) {
  if (!supported) {
    return (
      <div className="rounded-lg bg-[var(--surface-muted)] p-3 text-sm text-[var(--text-secondary)]">
        Это устройство не поддерживает озвучивание текста в браузере — Listening недоступен здесь. Это не
        студийная озвучка — используется встроенный синтезатор речи браузера, доступный на большинстве
        компьютеров и телефонов.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-[var(--text-secondary)]">
        Озвучивание через встроенный синтезатор речи браузера — не студийная запись, качество зависит от
        устройства.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={playing ? onPause : onPlay}
          className="focus-ring flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--color-forest)] px-4 text-sm font-bold text-white"
        >
          {playing ? "⏸ Пауза" : "▶ Слушать"}
        </button>
        <button
          type="button"
          onClick={onStop}
          aria-label="Остановить"
          className="focus-ring flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border-strong)]"
        >
          ⏹
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <label htmlFor="listening-rate" className="font-semibold">
          Скорость
        </label>
        <div className="flex items-center gap-2">
          <input
            id="listening-rate"
            type="range"
            min={0.5}
            max={1.5}
            step={0.1}
            value={rate}
            onChange={(e) => onRateChange(Number(e.target.value))}
            className="accent-[var(--color-forest)]"
          />
          <span className="w-9 text-right text-xs text-[var(--text-secondary)]">{rate.toFixed(1)}×</span>
        </div>
      </div>
    </div>
  );
}
