"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { tokenizeSentence } from "@/lib/tokenize";
import { WORD_LEVELS } from "@/lib/types";
import type { TranscriptSourceTag } from "@/lib/types";
import { log } from "@/lib/log";
import { track } from "@/lib/posthog-client";
import { findActiveSegmentIndex, formatTimestamp } from "@/lib/video-reader/segment-lookup";
import {
  YOUTUBE_PLAYER_LOADING,
  classifyYouTubePlayerError,
  getTranscriptNavigation,
  getYouTubePlayerFallback,
  youtubeApiUnavailableState,
  type YouTubePlayerState,
} from "@/lib/video-reader/youtube-player-state";
import {
  upsertWord,
  setWordLevel,
  addPhraseToDefaultDeck,
  finishReading,
  updateTextProgress,
} from "@/app/read/[textId]/actions";
import ReaderWordPanel, { type Popup } from "@/app/read/[textId]/reader-word-panel";

interface YTPlayerInstance {
  getCurrentTime(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
}

interface YTPlayerReadyEvent {
  target: YTPlayerInstance;
}

interface YTPlayerErrorEvent {
  data: number;
}

interface YTPlayerOptions {
  videoId: string;
  playerVars?: Record<string, number | string>;
  events?: {
    onReady?: (event: YTPlayerReadyEvent) => void;
    onError?: (event: YTPlayerErrorEvent) => void;
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
  flashcardId: string | null;
  deckId: string | null;
  learningState: Popup["learningState"] | null;
  contextCount: number;
}

const TRANSCRIPT_SOURCE_LABEL: Record<TranscriptSourceTag, string> = {
  manual_caption: "Субтитры автора",
  auto_caption: "Автоматические субтитры",
  innertube: "Автоматические субтитры",
  browser_bridge: "Импортировано из браузера",
  yt_dlp_caption: "Субтитры",
  speech_to_text: "Расшифровка речи",
};

// Non-fighting auto-scroll (Phase 3): while the user is following along we keep the active
// line centered; the moment they scroll manually we back off and offer a way back in instead
// of fighting their scroll on every tick. isAutoScrollingRef distinguishes "we just scrolled"
// from "the user just scrolled" for the same native scroll event.
const AUTO_SCROLL_SETTLE_MS = 700;
const POLL_INTERVAL_MS = 300;
const WATCH_DIAGNOSTIC_STORAGE_KEY = "lexreader:youtube-import-watch-diagnostic";

export default function WatchPlayer({
  textId,
  title,
  videoId,
  segments,
  sourceLang,
  targetLang,
  wordLevels,
  initialActiveIndex,
  durationSeconds,
  transcriptSource,
  processingStatus,
}: {
  textId: string;
  title: string;
  videoId: string;
  segments: Segment[];
  sourceLang: string;
  targetLang: string;
  wordLevels: Record<string, WordLevelInfo>;
  initialActiveIndex: number;
  durationSeconds: number | null;
  transcriptSource: TranscriptSourceTag | null;
  processingStatus: "pending" | "processing" | "ready" | "failed";
}) {
  const router = useRouter();
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const activeSegRef = useRef<HTMLDivElement | null>(null);
  const isAutoScrollingRef = useRef(false);
  const autoScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [activeIndex, setActiveIndex] = useState(initialActiveIndex);
  const [followMode, setFollowMode] = useState(true);
  const [levels, setLevels] = useState(wordLevels);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [manualTranslation, setManualTranslation] = useState("");
  const [playerState, setPlayerState] = useState<YouTubePlayerState>(YOUTUBE_PLAYER_LOADING);
  const playerReady = playerState.status === "ready";
  const [wordsLookedUp, setWordsLookedUp] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);

  const [selection, setSelection] = useState<{ si: number; start: number; end: number } | null>(null);
  const [boundaryHint, setBoundaryHint] = useState(false);
  const pressRef = useRef<{ timer: ReturnType<typeof setTimeout>; fired: boolean; si: number } | null>(null);
  const pointerHandledRef = useRef(false);

  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    startedAt.current = Date.now();
    track("video_reader_opened", { has_resume: initialActiveIndex > 0, segment_count: segments.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(WATCH_DIAGNOSTIC_STORAGE_KEY);
    if (!stored) return;
    try {
      const diagnostic = JSON.parse(stored) as {
        requestId?: string;
        videoId?: string;
        redirectTo?: string;
      };
      if (
        typeof diagnostic.requestId === "string" &&
        diagnostic.redirectTo === window.location.pathname
      ) {
        console.debug("[LexReader:diag] final_watch", {
          requestId: diagnostic.requestId,
          videoId: diagnostic.videoId ?? videoId,
          textId,
          pathname: window.location.pathname,
          uniqueSegments: segments.length,
        });
        console.debug("[LexReader:diag] final_watch_route", {
          requestId: diagnostic.requestId,
          videoId: diagnostic.videoId ?? videoId,
          textId,
          pathname: window.location.pathname,
          segmentCount: segments.length,
        });
        window.sessionStorage.removeItem(WATCH_DIAGNOSTIC_STORAGE_KEY);
      }
    } catch {
      window.sessionStorage.removeItem(WATCH_DIAGNOSTIC_STORAGE_KEY);
    }
  }, [segments.length, textId, videoId]);

  useEffect(() => {
    if (segments.length === 0) return;
    updateTextProgress({ textId, pageIndex: activeIndex, pageCount: segments.length }).catch((e) => {
      log.error({ kind: "text_progress_save", message: e instanceof Error ? e.message : "unknown" });
    });
  }, [textId, activeIndex, segments.length]);

  async function handleFinish() {
    setFinishing(true);
    setFinishError(null);
    const elapsed = Date.now() - (startedAt.current ?? Date.now());
    const minutes = Math.max(1, Math.round(elapsed / 60_000));
    try {
      await finishReading({ textId, minutes, wordsLookedUp });
      router.push("/library");
    } catch {
      setFinishing(false);
      setFinishError("Не удалось сохранить сессию просмотра. Попробуй ещё раз.");
    }
  }

  // Phase 2 — real YT IFrame Player, fixed onReady race (the pre-Gate-#3 version started
  // polling getCurrentTime() on a bare timer right after construction, with no guarantee the
  // player was actually ready yet). onReady is now the single source of truth for "player
  // usable"; polling/resume-seek only ever start from inside it.
  useEffect(() => {
    let cancelled = false;
    function createPlayer() {
      if (!window.YT || cancelled) return;
      playerRef.current = new window.YT.Player("yt-player", {
        videoId,
        playerVars: {
          origin: window.location.origin,
        },
        events: {
          onReady: (event) => {
            if (cancelled) return;
            setPlayerState({ status: "ready" });
            if (initialActiveIndex > 0 && segments[initialActiveIndex]) {
              event.target.seekTo(segments[initialActiveIndex].startMs / 1000, true);
            }
          },
          onError: (event) => {
            if (cancelled) return;
            const nextState = classifyYouTubePlayerError(event.data);
            setPlayerState(nextState);
            track("youtube_player_error", {
              error_code: event.data,
              player_state: nextState.status,
            });
          },
        },
      });
    }

    if (window.YT?.Player) {
      createPlayer();
      return;
    }

    const timeout = setTimeout(() => {
      if (!cancelled && !window.YT?.Player) {
        setPlayerState(youtubeApiUnavailableState());
      }
    }, 10_000);

    let tag = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (!tag) {
      tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }
    tag.onerror = () => {
      if (!cancelled) {
        setPlayerState(youtubeApiUnavailableState());
      }
    };
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      createPlayer();
      previousReady?.();
    };

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  useEffect(() => {
    if (!playerReady) return;
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== "function") return;
      const tMs = player.getCurrentTime() * 1000;
      setActiveIndex((prev) => findActiveSegmentIndex(segments, tMs, prev));
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [segments, playerReady]);

  // Non-fighting auto-scroll: only follow while followMode is on; a manual scroll (any scroll
  // event we didn't just cause ourselves) turns it off until the user opts back in.
  useEffect(() => {
    if (!followMode) return;
    isAutoScrollingRef.current = true;
    activeSegRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (autoScrollTimeoutRef.current) clearTimeout(autoScrollTimeoutRef.current);
    autoScrollTimeoutRef.current = setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, AUTO_SCROLL_SETTLE_MS);
  }, [activeIndex, followMode]);

  useEffect(() => {
    function onScroll() {
      if (isAutoScrollingRef.current) return;
      setFollowMode(false);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleSeek(startMs: number) {
    const navigation = getTranscriptNavigation("line", playerState, videoId, startMs);
    if (navigation.kind === "seek") {
      playerRef.current?.seekTo(navigation.seconds, true);
      setFollowMode(true);
    } else if (navigation.kind === "external") {
      window.open(navigation.url, "_blank", "noopener,noreferrer");
    }
  }

  function resumeFollowing() {
    setFollowMode(true);
  }

  async function runLookup(text: string, sentence: string, sentenceTimestampMs: number, isPhrase: boolean) {
    setPopup({ isPhrase, text, sentence, loading: true });
    setManualTranslation("");
    setWordsLookedUp((n) => n + 1);
    track("word_panel_opened", { is_phrase: isPhrase, surface: "video" });

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word: text, sentence, sourceLang, targetLang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка перевода");

      if (isPhrase) {
        setPopup({
          isPhrase,
          text,
          sentence,
          loading: false,
          wordTranslation: data.wordTranslation,
          sentenceTranslation: data.sentenceTranslation,
        });
        return;
      }

      const result = await upsertWord({
        textId,
        headword: text,
        translation: data.wordTranslation,
        contextSentence: sentence,
        contextTranslation: data.sentenceTranslation,
        sourceTimestampMs: sentenceTimestampMs,
      });

      if (!result.ok) {
        setPopup({
          isPhrase,
          text,
          sentence,
          loading: false,
          wordTranslation: data.wordTranslation,
          sentenceTranslation: data.sentenceTranslation,
          paywall: result.paywall,
        });
        return;
      }

      if (result.seenCount === 1) track("word_saved", { surface: "video" });

      setLevels((s) => ({
        ...s,
        [text.toLowerCase()]: {
          id: result.id!,
          level: result.level ?? 0,
          seenCount: result.seenCount ?? 1,
          flashcardId: result.flashcardId ?? null,
          deckId: result.deckId ?? null,
          learningState: (result.learningState as WordLevelInfo["learningState"]) ?? null,
          contextCount: result.contextCount ?? 0,
        },
      }));

      setPopup({
        isPhrase,
        text,
        sentence,
        loading: false,
        wordTranslation: data.wordTranslation,
        sentenceTranslation: data.sentenceTranslation,
        vocabId: result.id,
        level: result.level,
        seenCount: result.seenCount,
        alreadyKnown: (result.seenCount ?? 1) > 1,
        contextAdded: result.contextAdded,
        flashcardId: result.flashcardId,
        deckId: result.deckId,
        learningState: result.learningState as Popup["learningState"],
        contextCount: result.contextCount,
      });
    } catch (e) {
      setPopup({
        isPhrase,
        text,
        sentence,
        loading: false,
        error: e instanceof Error ? e.message : "Ошибка перевода",
      });
    }
  }

  const popupTimestampRef = useRef<number | null>(null);

  async function handleManualTranslation() {
    if (!popup || !manualTranslation.trim()) return;
    const translation = manualTranslation.trim();

    if (popup.isPhrase) {
      setPopup({ ...popup, error: undefined, wordTranslation: translation });
      return;
    }

    const result = await upsertWord({
      textId,
      headword: popup.text,
      translation,
      contextSentence: popup.sentence,
      contextTranslation: null,
      sourceTimestampMs: popupTimestampRef.current,
    });
    if (!result.ok) {
      setPopup({ ...popup, paywall: result.paywall, error: undefined });
      return;
    }
    if (result.seenCount === 1) track("word_saved", { surface: "video" });
    setLevels((s) => ({
      ...s,
      [popup.text.toLowerCase()]: {
        id: result.id!,
        level: result.level ?? 0,
        seenCount: result.seenCount ?? 1,
        flashcardId: result.flashcardId ?? null,
        deckId: result.deckId ?? null,
        learningState: (result.learningState as WordLevelInfo["learningState"]) ?? null,
        contextCount: result.contextCount ?? 0,
      },
    }));
    setPopup({
      ...popup,
      error: undefined,
      wordTranslation: translation,
      vocabId: result.id,
      level: result.level,
      seenCount: result.seenCount,
      alreadyKnown: (result.seenCount ?? 1) > 1,
      contextAdded: result.contextAdded,
      flashcardId: result.flashcardId,
      deckId: result.deckId,
      learningState: result.learningState as Popup["learningState"],
      contextCount: result.contextCount,
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

  async function handleAddPhrase() {
    if (!popup?.wordTranslation) return;
    const result = await addPhraseToDefaultDeck({
      textId,
      front: popup.text,
      back: popup.wordTranslation,
      contextSentence: popup.sentence,
      contextTranslation: popup.sentenceTranslation ?? null,
      sourceTimestampMs: popupTimestampRef.current,
    });
    if (!result.ok) {
      setPopup({ ...popup, paywall: result.paywall, error: result.paywall ? undefined : result.error });
      return;
    }
    if (!result.alreadyExisted) track("phrase_saved", { surface: "video" });
    setPopup({
      ...popup,
      saved: true,
      alreadyKnown: result.alreadyExisted,
      contextAdded: result.contextAdded,
      flashcardId: result.flashcardId,
      deckId: result.deckId,
      learningState: result.learningState as Popup["learningState"],
      contextCount: result.contextCount,
    });
  }

  function handlePracticeClick() {
    track("reader_practice_cta_clicked", {
      is_phrase: popup?.isPhrase,
      learning_state: popup?.learningState,
      surface: "video",
    });
  }

  function handleSpeak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = sourceLang;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  // Phase 12 — tokenize each caption line once, not on every render/tick.
  const segmentTokens = useMemo(() => segments.map((seg) => tokenizeSentence(seg.body)), [segments]);

  function onPointerDownWord(si: number, ti: number) {
    setBoundaryHint(false);
    const timer = setTimeout(() => {
      if (pressRef.current) {
        pressRef.current.fired = true;
        setSelection({ si, start: ti, end: ti });
      }
    }, 450);
    pressRef.current = { timer, fired: false, si };
  }

  function onPointerEnterWord(si: number, ti: number) {
    if (!pressRef.current?.fired) return;
    if (pressRef.current.si === si) {
      setBoundaryHint(false);
      setSelection((sel) => (sel && sel.si === si ? { ...sel, end: ti } : sel));
    } else {
      setBoundaryHint(true);
    }
  }

  function onPointerUpWord(si: number, ti: number, tokenText: string, sentence: string, timestampMs: number) {
    pointerHandledRef.current = true;
    const press = pressRef.current;
    if (press) clearTimeout(press.timer);
    setBoundaryHint(false);

    if (press?.fired) {
      setSelection((sel) => {
        if (sel && sel.si === si) {
          const lo = Math.min(sel.start, sel.end);
          const hi = Math.max(sel.start, sel.end);
          const tokens = segmentTokens[si];
          const phraseText = tokens
            .slice(lo, hi + 1)
            .map((t) => t.text)
            .join("")
            .trim();
          popupTimestampRef.current = timestampMs;
          if (phraseText.includes(" ")) {
            runLookup(phraseText, sentence, timestampMs, true);
          } else {
            runLookup(phraseText || tokenText, sentence, timestampMs, false);
          }
        }
        return null;
      });
    } else if (!selection) {
      popupTimestampRef.current = timestampMs;
      runLookup(tokenText, sentence, timestampMs, false);
    }
    pressRef.current = null;
  }

  function onClickWord(tokenText: string, sentence: string, timestampMs: number) {
    if (pointerHandledRef.current) {
      pointerHandledRef.current = false;
      return;
    }
    popupTimestampRef.current = timestampMs;
    runLookup(tokenText, sentence, timestampMs, false);
  }

  function isTokenSelected(si: number, ti: number): boolean {
    if (!selection || selection.si !== si) return false;
    const lo = Math.min(selection.start, selection.end);
    const hi = Math.max(selection.start, selection.end);
    return ti >= lo && ti <= hi;
  }

  const activeSegment = segments[activeIndex] as Segment | undefined;
  const totalLabel = durationSeconds != null ? formatTimestamp(durationSeconds * 1000) : null;
  const sourceLabel = transcriptSource ? TRANSCRIPT_SOURCE_LABEL[transcriptSource] : null;
  const playerFallback = getYouTubePlayerFallback(playerState, videoId);

  return (
    <div className="relative flex min-h-screen flex-1 flex-col bg-[#f7f4ee] dark:bg-background">
      <header className="sticky top-0 z-10 border-b border-black/[0.07] bg-[#f7f4ee]/95 backdrop-blur-xl dark:border-white/10 dark:bg-background/95">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/library"
            aria-label="Библиотека"
            className="focus-ring flex min-h-11 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-semibold text-[var(--color-forest-text)] transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
          >
            <span aria-hidden="true">←</span>
            <span className="hidden sm:inline" aria-hidden="true">
              Библиотека
            </span>
          </Link>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-base font-bold tracking-[-0.01em] sm:text-lg">{title}</h1>
            <p className="mt-0.5 truncate text-xs text-[var(--text-secondary)]">
              {[sourceLabel, totalLabel, `просмотрено слов: ${wordsLookedUp}`].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button
            type="button"
            onClick={handleFinish}
            disabled={finishing}
            aria-label="Завершить просмотр"
            className="focus-ring flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/70 text-black/50 shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:text-red-500 disabled:opacity-50 dark:border-white/15 dark:bg-white/10 dark:text-white/60"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
              <path strokeLinecap="round" d="m7 7 10 10M17 7 7 17" />
            </svg>
          </button>
        </div>
      </header>

      {finishError && (
        <div className="px-4 pt-2 text-center text-sm text-[var(--color-danger)]" role="alert">
          {finishError}
        </div>
      )}

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-5 sm:px-6 sm:py-7 lg:flex-row lg:items-start">
        <main className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="sticky top-[68px] z-[5] overflow-hidden rounded-2xl bg-black shadow-[0_18px_60px_rgba(80,60,35,0.12)]">
            <div className="relative aspect-video w-full">
              {playerFallback ? (
                <div
                  className="flex h-full flex-col items-center justify-center px-6 text-center sm:px-10"
                  data-player-state={playerState.status}
                  data-testid="youtube-player-fallback"
                  role="status"
                >
                  <div
                    className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-xl text-white"
                    aria-hidden="true"
                  >
                    ↗
                  </div>
                  <h2 className="text-base font-bold text-white sm:text-lg">{playerFallback.title}</h2>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/70">
                    {playerFallback.description}
                  </p>
                  <a
                    href={playerFallback.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="focus-ring mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-sm font-bold text-black transition hover:bg-white/90"
                  >
                    {playerFallback.actionLabel}
                  </a>
                </div>
              ) : (
                <div id="yt-player" className="absolute inset-0 h-full w-full" />
              )}
            </div>
          </div>

          {segments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-strong)] p-6 text-center text-sm text-[var(--text-secondary)]">
              {processingStatus === "pending" || processingStatus === "processing"
                ? "Субтитры ещё обрабатываются — попробуй обновить страницу через минуту."
                : "Транскрипт для этого видео недоступен."}
            </div>
          ) : (
            <div className="relative flex flex-col gap-1 rounded-3xl border border-black/[0.06] bg-white/60 px-3 py-4 dark:border-white/10 dark:bg-white/[0.035] sm:px-5">
              {segments.map((seg, si) => {
                const isActive = si === activeIndex;
                return (
                  <div
                    key={seg.id}
                    ref={isActive ? activeSegRef : undefined}
                    className={`flex items-start gap-3 rounded-lg px-1 py-1.5 transition-colors ${
                      isActive ? "bg-[var(--color-forest-tint)]" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSeek(seg.startMs)}
                      aria-label={`Перейти к ${formatTimestamp(seg.startMs)}`}
                      className="focus-ring flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md px-1.5 font-mono text-xs tabular-nums text-[var(--text-secondary)] hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                    >
                      {formatTimestamp(seg.startMs)}
                    </button>
                    <p
                      onClick={() => handleSeek(seg.startMs)}
                      className={`min-w-0 flex-1 cursor-pointer py-1.5 leading-relaxed ${
                        isActive ? "text-base font-medium" : "text-[15px] text-black/60 dark:text-white/60"
                      }`}
                    >
                      {segmentTokens[si].map((tok, ti) => {
                        if (!tok.isWord) return <span key={ti}>{tok.text}</span>;
                        const info = levels[tok.text.toLowerCase()];
                        const levelColor = info ? WORD_LEVELS[info.level]?.color : undefined;
                        const selected = isTokenSelected(si, ti);
                        return (
                          <button
                            key={ti}
                            type="button"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              onPointerDownWord(si, ti);
                            }}
                            onPointerEnter={() => onPointerEnterWord(si, ti)}
                            onPointerUp={(e) => {
                              e.stopPropagation();
                              onPointerUpWord(si, ti, tok.text, seg.body, seg.startMs);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onClickWord(tok.text, seg.body, seg.startMs);
                            }}
                            style={{
                              backgroundColor: selected ? "#a67c5266" : levelColor ? `${levelColor}33` : undefined,
                            }}
                            className="focus-ring touch-none select-none rounded px-0.5 transition-colors [-webkit-touch-callout:none] hover:bg-yellow-100 dark:hover:bg-yellow-900/40"
                          >
                            {tok.text}
                          </button>
                        );
                      })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {popup ? (
          <aside className="hidden w-full shrink-0 lg:sticky lg:top-[68px] lg:flex lg:w-[340px] lg:flex-col">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
              <ReaderWordPanel
                popup={popup}
                manualTranslation={manualTranslation}
                onManualTranslationChange={setManualTranslation}
                onManualTranslationSubmit={handleManualTranslation}
                onSpeak={handleSpeak}
                onSetLevel={handleSetLevel}
                onAddPhrase={handleAddPhrase}
                onPracticeClick={handlePracticeClick}
                onClose={() => setPopup(null)}
              />
            </div>
          </aside>
        ) : (
          <aside className="hidden w-full shrink-0 lg:sticky lg:top-[68px] lg:flex lg:w-[340px] lg:flex-col">
            <div className="rounded-2xl border border-dashed border-[var(--border-strong)] p-4 text-center text-sm text-[var(--text-secondary)]">
              Нажми на слово в субтитрах, чтобы посмотреть перевод
            </div>
          </aside>
        )}
      </div>

      {boundaryHint && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-20 flex justify-center px-5">
          <div className="rounded-full bg-black/80 px-4 py-2 text-xs text-white dark:bg-white/90 dark:text-black">
            Фразу можно выделить только в пределах одной строки субтитров
          </div>
        </div>
      )}

      {!followMode && activeSegment && (
        <button
          type="button"
          onClick={resumeFollowing}
          className="focus-ring fixed inset-x-0 bottom-24 z-20 mx-auto flex min-h-11 w-fit items-center gap-1.5 rounded-full bg-[var(--color-forest)] px-4 text-sm font-bold text-white shadow-lg lg:bottom-6"
        >
          ↓ Вернуться к текущей строке
        </button>
      )}

      {/* Mobile bottom sheet — same ReaderWordPanel content, different chrome */}
      {popup && (
        <div className="fixed inset-x-0 bottom-0 z-20 rounded-t-2xl border-t border-black/10 bg-[var(--surface)] p-5 shadow-2xl dark:border-white/10 lg:hidden">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-[var(--border-strong)]" aria-hidden="true" />
          <div className="mx-auto max-w-2xl">
            <ReaderWordPanel
              popup={popup}
              manualTranslation={manualTranslation}
              onManualTranslationChange={setManualTranslation}
              onManualTranslationSubmit={handleManualTranslation}
              onSpeak={handleSpeak}
              onSetLevel={handleSetLevel}
              onAddPhrase={handleAddPhrase}
              onPracticeClick={handlePracticeClick}
              onClose={() => setPopup(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
