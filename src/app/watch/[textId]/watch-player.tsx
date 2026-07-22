"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { tokenizeSentence } from "@/lib/tokenize";
import { WORD_LEVELS } from "@/lib/types";
import { upsertWord, setWordLevel } from "@/app/read/[textId]/actions";

interface YTPlayerInstance {
  getCurrentTime(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
}

interface YTPlayerOptions {
  videoId: string;
  events?: {
    onReady?: (event: { target: YTPlayerInstance }) => void;
  };
}

declare global {
  interface Window {
    YT?: { Player: new (elementId: string, options: YTPlayerOptions) => YTPlayerInstance };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface Segment {
  id: string;
  startMs: number;
  endMs: number;
  body: string;
}

interface WordLevelInfo {
  id: string;
  level: number;
  seenCount: number;
}

interface Popup {
  text: string;
  sentence: string;
  loading: boolean;
  wordTranslation?: string;
  sentenceTranslation?: string | null;
  error?: string;
  paywall?: boolean;
  vocabId?: string;
  level?: number;
  seenCount?: number;
}

const VISIBLE_BEFORE = 2;
const VISIBLE_AFTER = 3;

function findActiveIndex(segments: Segment[], currentPrev: number, tMs: number): number {
  for (let i = 0; i < segments.length; i++) {
    if (tMs >= segments[i].startMs && tMs < segments[i].endMs) return i;
  }
  let idx = currentPrev;
  for (let i = 0; i < segments.length; i++) {
    if (segments[i].startMs <= tMs) idx = i;
    else break;
  }
  return idx;
}

export default function WatchPlayer({
  textId,
  title,
  videoId,
  segments,
  sourceLang,
  targetLang,
  wordLevels,
}: {
  textId: string;
  title: string;
  videoId: string;
  segments: Segment[];
  sourceLang: string;
  targetLang: string;
  wordLevels: Record<string, WordLevelInfo>;
}) {
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const activeSegRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [levels, setLevels] = useState(wordLevels);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [manualTranslation, setManualTranslation] = useState("");

  useEffect(() => {
    function createPlayer() {
      if (!window.YT) return;
      playerRef.current = new window.YT.Player("yt-player", { videoId });
    }

    if (window.YT?.Player) {
      createPlayer();
    } else {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
      window.onYouTubeIframeAPIReady = createPlayer;
    }
  }, [videoId]);

  useEffect(() => {
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== "function") return;
      const tMs = player.getCurrentTime() * 1000;
      setActiveIndex((prev) => findActiveIndex(segments, prev, tMs));
    }, 300);
    return () => clearInterval(interval);
  }, [segments]);

  useEffect(() => {
    activeSegRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIndex]);

  function handleSeek(startMs: number) {
    playerRef.current?.seekTo(startMs / 1000, true);
  }

  async function handleWordTap(text: string, sentence: string) {
    setPopup({ text, sentence, loading: true });
    setManualTranslation("");

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: text, sentence, sourceLang, targetLang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка перевода");

      const result = await upsertWord({
        textId,
        headword: text,
        translation: data.wordTranslation,
        contextSentence: sentence,
        contextTranslation: data.sentenceTranslation,
      });

      if (!result.ok) {
        setPopup({
          text,
          sentence,
          loading: false,
          wordTranslation: data.wordTranslation,
          sentenceTranslation: data.sentenceTranslation,
          paywall: result.paywall,
        });
        return;
      }

      setLevels((s) => ({
        ...s,
        [text.toLowerCase()]: {
          id: result.id!,
          level: result.level ?? 0,
          seenCount: result.seenCount ?? 1,
        },
      }));

      setPopup({
        text,
        sentence,
        loading: false,
        wordTranslation: data.wordTranslation,
        sentenceTranslation: data.sentenceTranslation,
        vocabId: result.id,
        level: result.level,
        seenCount: result.seenCount,
      });
    } catch (e) {
      setPopup({
        text,
        sentence,
        loading: false,
        error: e instanceof Error ? e.message : "Ошибка перевода",
      });
    }
  }

  async function handleManualTranslation() {
    if (!popup || !manualTranslation.trim()) return;
    const translation = manualTranslation.trim();

    const result = await upsertWord({
      textId,
      headword: popup.text,
      translation,
      contextSentence: popup.sentence,
      contextTranslation: null,
    });
    if (!result.ok) {
      setPopup({ ...popup, paywall: result.paywall, error: undefined });
      return;
    }
    setLevels((s) => ({
      ...s,
      [popup.text.toLowerCase()]: {
        id: result.id!,
        level: result.level ?? 0,
        seenCount: result.seenCount ?? 1,
      },
    }));
    setPopup({
      ...popup,
      error: undefined,
      wordTranslation: translation,
      vocabId: result.id,
      level: result.level,
      seenCount: result.seenCount,
    });
  }

  async function handleSetLevel(level: 0 | 1 | 2 | 3 | 4) {
    if (!popup?.vocabId) return;
    setPopup({ ...popup, level });
    setLevels((s) => ({
      ...s,
      [popup.text.toLowerCase()]: { ...s[popup.text.toLowerCase()], level },
    }));
    await setWordLevel(popup.vocabId, level);
  }

  const from = Math.max(0, activeIndex - VISIBLE_BEFORE);
  const to = Math.min(segments.length, activeIndex + VISIBLE_AFTER);
  const visibleSegments = segments.slice(from, to);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 border-b border-black/10 bg-background/95 px-4 py-3 backdrop-blur dark:border-white/10">
        <Link href="/library" className="shrink-0 text-sm font-medium text-caramel">
          ← Библиотека
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-base font-medium">{title}</h1>
      </header>

      <div className="h-[40dvh] w-full shrink-0 bg-black">
        <div id="yt-player" className="h-full w-full" />
      </div>

      {segments.length === 0 ? (
        <p className="px-5 py-6 text-sm text-black/50 dark:text-white/50">
          Субтитры для этого видео ещё не загружены.
        </p>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {visibleSegments.map((seg, i) => {
            const idx = from + i;
            const isActive = idx === activeIndex;
            return (
              <div
                key={seg.id}
                ref={isActive ? activeSegRef : undefined}
                onClick={() => handleSeek(seg.startMs)}
                className={`mb-2 cursor-pointer rounded-lg px-3 py-2 transition-colors ${
                  isActive
                    ? "bg-caramel/10 text-lg font-medium"
                    : "text-black/40 hover:bg-black/5 dark:text-white/40 dark:hover:bg-white/5"
                }`}
              >
                {tokenizeSentence(seg.body).map((tok, ti) => {
                  if (!tok.isWord) return <span key={ti}>{tok.text}</span>;
                  const info = levels[tok.text.toLowerCase()];
                  const levelColor = info ? WORD_LEVELS[info.level]?.color : undefined;
                  return (
                    <button
                      key={ti}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleWordTap(tok.text, seg.body);
                      }}
                      style={{ backgroundColor: levelColor ? `${levelColor}33` : undefined }}
                      className="touch-none select-none rounded px-0.5 [-webkit-touch-callout:none] hover:bg-yellow-100 dark:hover:bg-yellow-900/40"
                    >
                      {tok.text}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {popup && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-card p-5 shadow-2xl dark:border-white/10">
          <div className="mx-auto flex max-w-2xl flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-lg font-semibold">{popup.text}</p>
                {popup.loading ? (
                  <p className="text-black/50 dark:text-white/50">Переводим…</p>
                ) : popup.paywall ? (
                  <p className="text-black/60 dark:text-white/60">
                    Бесплатный лимит слов на сегодня исчерпан.{" "}
                    <Link href="/pricing?reason=words" className="text-caramel underline">
                      Смотреть Premium
                    </Link>
                  </p>
                ) : popup.error ? (
                  <div className="mt-1 rounded-lg bg-red-50 p-3 dark:bg-red-950/40">
                    <p className="text-sm text-red-600 dark:text-red-400">{popup.error}</p>
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={manualTranslation}
                        onChange={(e) => setManualTranslation(e.target.value)}
                        placeholder="Впиши перевод вручную"
                        className="min-w-0 flex-1 rounded border border-black/15 px-2 py-1 text-sm dark:border-white/20"
                      />
                      <button
                        type="button"
                        onClick={handleManualTranslation}
                        disabled={!manualTranslation.trim()}
                        className="shrink-0 text-sm font-medium text-caramel disabled:opacity-40"
                      >
                        + Add translation
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-black/80 dark:text-white/80">{popup.wordTranslation}</p>
                    {popup.level !== undefined && (
                      <p className="mt-1 text-sm text-black/50 dark:text-white/50">
                        {WORD_LEVELS[popup.level].label} · Seen {popup.seenCount}×
                      </p>
                    )}
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setPopup(null)}
                aria-label="Закрыть"
                className="shrink-0 text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            {popup.vocabId && (
              <div>
                <p className="mb-1 text-xs font-medium text-black/50 dark:text-white/50">
                  Уровень знания
                </p>
                <div className="grid grid-cols-5 gap-1.5">
                  {WORD_LEVELS.map((l) => (
                    <button
                      key={l.level}
                      type="button"
                      onClick={() => handleSetLevel(l.level as 0 | 1 | 2 | 3 | 4)}
                      style={{
                        backgroundColor: popup.level === l.level ? l.color : `${l.color}33`,
                      }}
                      className="rounded-lg py-1.5 text-sm font-medium"
                    >
                      {l.level}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
