"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { splitIntoSentences, tokenizeSentence } from "@/lib/tokenize";
import { WORD_LEVELS } from "@/lib/types";
import { log } from "@/lib/log";
import { track } from "@/lib/posthog-client";
import {
  upsertWord,
  setWordLevel,
  addPhraseToDefaultDeck,
  finishReading,
  updateTextProgress,
} from "./actions";
import ReaderSettings, { useReaderPrefs, READING_WIDTH_PX } from "./reader-settings";
import ReaderWordPanel, { type Popup } from "./reader-word-panel";
import ReaderListening, { useListening } from "./reader-listening";
import { useParallelTranslation } from "./use-parallel-translation";
import { useReaderKeyboardShortcuts } from "./use-keyboard-shortcuts";

const READING_THEME_COLORS: Record<string, { bg: string; surface: string; text: string } | null> = {
  paper: null,
  sepia: { bg: "#f2e6cf", surface: "#fbf3e0", text: "#3f2f1a" },
  dark: { bg: "#1c1a16", surface: "#242019", text: "#e8e2d4" },
};

type ReaderMode = "assisted" | "focus" | "parallel" | "listening";

interface WordLevelInfo {
  id: string;
  level: number;
  seenCount: number;
}

interface Stats {
  unique: number;
  new: number;
  learning: number;
  familiar: number;
  known: number;
}

export interface ChapterInfo {
  collectionTitle: string;
  position: number;
  total: number;
  prevTextId: string | null;
  nextTextId: string | null;
}

// A page should feel like a reading screen, not a short excerpt floating in an
// otherwise empty viewport. This keeps enough context on desktop while still
// remaining comfortable to scan on smaller screens.
const WORDS_PER_PAGE = 260;

function paginate(sentences: string[]): [number, number][] {
  const pages: [number, number][] = [];
  let start = 0;
  let wordCount = 0;
  for (let i = 0; i < sentences.length; i++) {
    wordCount += sentences[i].split(/\s+/).filter(Boolean).length;
    if (wordCount >= WORDS_PER_PAGE) {
      pages.push([start, i + 1]);
      start = i + 1;
      wordCount = 0;
    }
  }
  if (start < sentences.length) pages.push([start, sentences.length]);
  return pages.length > 0 ? pages : [[0, 0]];
}

export default function Reader({
  textId,
  title,
  body,
  sourceLang,
  targetLang,
  wordLevels,
  stats,
  initialPageIndex = 0,
  chapter,
}: {
  textId: string;
  title: string;
  body: string;
  sourceLang: string;
  targetLang: string;
  wordLevels: Record<string, WordLevelInfo>;
  stats: Stats;
  initialPageIndex?: number;
  chapter: ChapterInfo | null;
}) {
  const router = useRouter();
  const sentences = useMemo(() => splitIntoSentences(body), [body]);
  const pages = useMemo(() => paginate(sentences), [sentences]);

  const [levels, setLevels] = useState(wordLevels);
  const [pageIndex, setPageIndex] = useState(() =>
    Math.min(Math.max(initialPageIndex, 0), pages.length - 1),
  );
  const [popup, setPopup] = useState<Popup | null>(null);
  const [wordsLookedUp, setWordsLookedUp] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  const [manualTranslation, setManualTranslation] = useState("");
  const [readerPrefs, setReaderPrefs] = useReaderPrefs();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mode, setMode] = useState<ReaderMode>("assisted");
  const [activeListeningIndex, setActiveListeningIndex] = useState<number | null>(null);

  const themeColors = READING_THEME_COLORS[readerPrefs.theme];

  const [selection, setSelection] = useState<{ si: number; start: number; end: number } | null>(
    null,
  );
  const [boundaryHint, setBoundaryHint] = useState(false);
  const pressRef = useRef<{ timer: ReturnType<typeof setTimeout>; fired: boolean; si: number } | null>(
    null,
  );

  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    startedAt.current = Date.now();
    track("reader_opened", { has_chapter: chapter !== null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    updateTextProgress({ textId, pageIndex, pageCount: pages.length }).catch((e) => {
      // P0-АУДИТ 3.18: не показываем это как ошибку пользователю (фоновое
      // сохранение позиции страницы не критично для самого чтения), но
      // больше не теряем это молча — попадёт хотя бы в консоль браузера.
      log.error({ kind: "text_progress_save", message: e instanceof Error ? e.message : "unknown" });
    });
  }, [textId, pageIndex, pages.length]);

  const [pageStart, pageEnd] = pages[pageIndex];
  const pageSentences = useMemo(() => sentences.slice(pageStart, pageEnd), [sentences, pageStart, pageEnd]);

  function updateReaderPrefs(next: typeof readerPrefs) {
    setReaderPrefs(next);
    track("reader_settings_changed");
  }

  function changeMode(next: ReaderMode) {
    if (next === mode) return;
    setMode(next);
    track("reader_mode_changed", { mode: next });
    if (next === "parallel") track("parallel_mode_opened");
  }

  async function runLookup(text: string, sentence: string, isPhrase: boolean) {
    setPopup({ isPhrase, text, sentence, loading: true });
    setManualTranslation("");
    setWordsLookedUp((n) => n + 1);
    track("word_panel_opened", { is_phrase: isPhrase });

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

      if (result.seenCount === 1) track("word_saved");

      setLevels((s) => ({
        ...s,
        [text.toLowerCase()]: {
          id: result.id!,
          level: result.level ?? 0,
          seenCount: result.seenCount ?? 1,
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
    });
    if (!result.ok) {
      setPopup({ ...popup, paywall: result.paywall, error: undefined });
      return;
    }
    if (result.seenCount === 1) track("word_saved");
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
    if (level === 4) track("word_marked_known");
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
    });
    if (!result.ok) {
      setPopup({ ...popup, paywall: result.paywall, error: result.paywall ? undefined : result.error });
      return;
    }
    track("phrase_saved");
    setPopup({ ...popup, saved: true });
  }

  function handleSpeak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = sourceLang;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  async function handleFinish() {
    setFinishing(true);
    setFinishError(null);
    const elapsed = Date.now() - (startedAt.current ?? Date.now());
    const minutes = Math.max(1, Math.round(elapsed / 60_000));
    try {
      await finishReading({ textId, minutes, wordsLookedUp });
      router.push("/library");
    } catch {
      // P0-АУДИТ 3.18: раньше редирект на /library происходил ВСЕГДА даже
      // при сбое сохранения сессии/стрика — ошибка была полностью невидима.
      setFinishing(false);
      setFinishError("Не удалось сохранить сессию чтения. Попробуй ещё раз.");
    }
  }

  function goPrevChapter() {
    if (chapter?.prevTextId) {
      track("chapter_changed", { direction: "prev" });
      router.push(`/read/${chapter.prevTextId}`);
    }
  }
  function goNextChapter() {
    if (chapter?.nextTextId) {
      track("chapter_changed", { direction: "next" });
      router.push(`/read/${chapter.nextTextId}`);
    }
  }

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

  function onPointerUpWord(si: number, ti: number, tokenText: string, sentence: string) {
    const press = pressRef.current;
    if (press) clearTimeout(press.timer);
    setBoundaryHint(false);

    if (press?.fired) {
      setSelection((sel) => {
        if (sel && sel.si === si) {
          const lo = Math.min(sel.start, sel.end);
          const hi = Math.max(sel.start, sel.end);
          const tokens = tokenizeSentence(sentences[si]);
          const phraseText = tokens
            .slice(lo, hi + 1)
            .map((t) => t.text)
            .join("")
            .trim();
          if (phraseText.includes(" ")) {
            runLookup(phraseText, sentence, true);
          } else {
            runLookup(phraseText || tokenText, sentence, false);
          }
        }
        return null;
      });
    } else if (!selection) {
      runLookup(tokenText, sentence, false);
    }
    pressRef.current = null;
  }

  function isTokenSelected(si: number, ti: number): boolean {
    if (!selection || selection.si !== si) return false;
    const lo = Math.min(selection.start, selection.end);
    const hi = Math.max(selection.start, selection.end);
    return ti >= lo && ti <= hi;
  }

  // Listening mode — real browser TTS, tracks the sentence currently spoken.
  const listening = useListening({
    sentences: pageSentences,
    sourceLang,
    onActiveChange: setActiveListeningIndex,
  });
  useEffect(() => {
    if (mode !== "listening" && listening.playing) listening.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // Parallel mode — real per-sentence translation, no paid API (see hook doc).
  const parallel = useParallelTranslation({
    active: mode === "parallel",
    sentences: pageSentences,
    sourceLang,
    targetLang,
  });

  useReaderKeyboardShortcuts({
    onPrevChapterOrPage: () => {
      if (pageIndex > 0) setPageIndex((i) => i - 1);
      else goPrevChapter();
    },
    onNextChapterOrPage: () => {
      if (pageIndex < pages.length - 1) setPageIndex((i) => i + 1);
      else goNextChapter();
    },
    onToggleFocus: () => changeMode(mode === "focus" ? "assisted" : "focus"),
    onTogglePlayPause: () => {
      if (mode === "listening") listening.togglePlayPause();
    },
    onEscape: () => {
      if (popup) setPopup(null);
      else if (settingsOpen) setSettingsOpen(false);
      else if (mode === "focus") changeMode("assisted");
    },
  });

  const readingProgress = Math.round(((pageIndex + 1) / pages.length) * 100);
  const maxWidthPx = READING_WIDTH_PX[readerPrefs.width];
  const focusMode = mode === "focus";

  return (
    <div
      className="relative flex min-h-screen flex-1 flex-col bg-[#f7f4ee] dark:bg-background"
      style={themeColors ? { backgroundColor: themeColors.bg, color: themeColors.text } : undefined}
    >
      <header
        className="sticky top-0 z-10 border-b border-black/[0.07] bg-[#f7f4ee]/95 backdrop-blur-xl dark:border-white/10 dark:bg-background/95"
        style={themeColors ? { backgroundColor: `${themeColors.bg}f2` } : undefined}
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
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
              <nav aria-label="Хлебные крошки" className="truncate text-xs text-[var(--text-secondary)]">
                <Link href="/library" className="focus-ring hover:underline">
                  Библиотека
                </Link>
                {chapter && <span> › {chapter.collectionTitle}</span>}
              </nav>
              <h1 className="truncate text-base font-bold tracking-[-0.01em] sm:text-lg">{title}</h1>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                {chapter ? `Часть ${chapter.position} из ${chapter.total} · ` : ""}
                Страница {pageIndex + 1} из {pages.length} · просмотрено слов: {wordsLookedUp}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label="Настройки чтения"
                className="focus-ring flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/70 text-[var(--color-forest-text)] shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-white/15 dark:bg-white/10"
              >
                <span aria-hidden="true" className="text-base font-bold">
                  Aa
                </span>
              </button>
              <button
                type="button"
                onClick={handleFinish}
                disabled={finishing}
                aria-label="Завершить чтение"
                className="focus-ring flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white/70 text-black/50 shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:text-red-500 disabled:opacity-50 dark:border-white/15 dark:bg-white/10 dark:text-white/60"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
                  <path strokeLinecap="round" d="m7 7 10 10M17 7 7 17" />
                </svg>
              </button>
            </div>
          </div>

          {!focusMode && (
            <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Режим чтения">
              {(
                [
                  ["assisted", "Assisted"],
                  ["focus", "Focus"],
                  ["parallel", "Parallel"],
                  ["listening", "Listening"],
                ] as [ReaderMode, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={mode === value}
                  onClick={() => changeMode(value)}
                  className={`focus-ring min-h-11 rounded-full border px-3.5 text-xs font-bold whitespace-nowrap ${
                    mode === value
                      ? "border-[var(--color-forest)] bg-[var(--color-forest)] text-white"
                      : "border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-secondary)]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {focusMode && (
            <button
              type="button"
              onClick={() => changeMode("assisted")}
              className="focus-ring flex min-h-11 items-center self-start rounded-full border border-[var(--border-strong)] px-3.5 text-xs font-bold text-[var(--text-secondary)]"
            >
              ✕ Выйти из Focus
            </button>
          )}
        </div>
        <div className="h-0.5 bg-black/[0.04] dark:bg-white/[0.05]">
          <div
            className="h-full bg-[var(--color-forest)] transition-[width] duration-300"
            style={{ width: `${readingProgress}%` }}
          />
        </div>
      </header>

      <div className={`mx-auto flex w-full flex-1 flex-col gap-5 px-4 py-5 sm:px-6 sm:py-7 ${focusMode ? "max-w-5xl" : "max-w-6xl lg:flex-row lg:items-start"}`}>
        <main className="flex flex-1 flex-col">
          {!focusMode && (
            <>
              <section
                aria-label="Статистика текста"
                className="mb-4 grid grid-cols-5 divide-x divide-black/[0.06] rounded-2xl border border-black/[0.06] bg-white/55 px-2 py-3 text-center text-sm shadow-[0_8px_30px_rgba(80,60,35,0.04)] dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.04] sm:px-5"
              >
                <div className="px-1">
                  <p className="font-bold">{stats.unique}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--text-secondary)] sm:text-xs">Всего</p>
                </div>
                <div className="px-1">
                  <p className="font-bold text-accent-orange">{stats.new}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--text-secondary)] sm:text-xs">Новые</p>
                </div>
                <div className="px-1">
                  <p className="font-bold text-orange-400">{stats.learning}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--text-secondary)] sm:text-xs">Учу</p>
                </div>
                <div className="px-1">
                  <p className="font-bold text-orange-300">{stats.familiar}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--text-secondary)] sm:text-xs">Знакомые</p>
                </div>
                <div className="px-1">
                  <p className="font-bold text-accent-green">{stats.known}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-[var(--text-secondary)] sm:text-xs">Знаю</p>
                </div>
              </section>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 pb-4 text-[11px] text-[var(--text-secondary)] sm:text-xs">
                {WORD_LEVELS.map((l) => (
                  <span key={l.level} className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full ring-2 ring-white/70 dark:ring-black/20"
                      style={{ backgroundColor: l.color }}
                    />
                    {l.label}
                  </span>
                ))}
                <span className="basis-full italic sm:ml-auto sm:basis-auto">Зажми слово и протяни, чтобы выделить фразу</span>
              </div>
            </>
          )}

          {mode === "parallel" ? (
            <div
              className="mx-auto w-full flex-1 rounded-3xl border border-black/[0.06] bg-white/60 px-5 py-6 dark:border-white/10 dark:bg-white/[0.035] sm:px-9 sm:py-8"
              style={{ maxWidth: `${maxWidthPx}px` }}
            >
              <p className="mb-4 text-xs text-[var(--text-secondary)]">
                Перевод по предложениям — переводится только эта страница, кэшируется для всех.
              </p>
              {pageSentences.map((sentence, i) => (
                <div key={i} className="mb-4 border-b border-black/[0.05] pb-4 last:border-0 dark:border-white/[0.06]">
                  <p style={{ fontSize: `${readerPrefs.fontSize}px`, lineHeight: readerPrefs.lineHeight }}>{sentence}</p>
                  {parallel.statuses[i] === "loading" && (
                    <p className="mt-1 text-sm text-[var(--text-secondary)]" aria-live="polite">
                      Переводим…
                    </p>
                  )}
                  {parallel.statuses[i] === "unavailable" && (
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Перевод временно недоступен (лимит запросов) — попробуй через минуту.
                    </p>
                  )}
                  {parallel.statuses[i] === "error" && (
                    <p className="mt-1 text-sm text-[var(--color-danger)]" role="alert">
                      Не удалось перевести это предложение.
                    </p>
                  )}
                  {parallel.translations[i] && (
                    <p className="mt-1 text-[var(--color-forest-text)]" style={{ fontSize: `${readerPrefs.fontSize - 2}px` }}>
                      {parallel.translations[i]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <article
              className="mx-auto w-full flex-1 rounded-3xl border border-black/[0.06] bg-white/60 px-5 py-6 tracking-[-0.006em] shadow-[0_18px_60px_rgba(80,60,35,0.06)] dark:border-white/10 dark:bg-white/[0.035] sm:px-9 sm:py-8"
              style={{
                maxWidth: `${maxWidthPx}px`,
                fontSize: `${readerPrefs.fontSize}px`,
                lineHeight: readerPrefs.lineHeight,
                ...(themeColors ? { backgroundColor: themeColors.surface, color: themeColors.text } : {}),
              }}
            >
              {pageSentences.map((sentence, localIdx) => {
                const si = pageStart + localIdx;
                const isSpeaking = mode === "listening" && activeListeningIndex === localIdx;
                return (
                  <span key={si} className={isSpeaking ? "rounded bg-[var(--color-forest-tint)]" : undefined}>
                    {tokenizeSentence(sentence).map((tok, ti) => {
                      if (!tok.isWord) return <span key={ti}>{tok.text}</span>;

                      const info = levels[tok.text.toLowerCase()];
                      const levelColor = info ? WORD_LEVELS[info.level]?.color : undefined;
                      const selected = isTokenSelected(si, ti);

                      return (
                        <button
                          key={ti}
                          type="button"
                          onPointerDown={() => onPointerDownWord(si, ti)}
                          onPointerEnter={() => onPointerEnterWord(si, ti)}
                          onPointerUp={() => onPointerUpWord(si, ti, tok.text, sentence)}
                          style={{
                            backgroundColor: selected
                              ? "#a67c5266"
                              : levelColor
                                ? `${levelColor}33`
                                : undefined,
                          }}
                          className="focus-ring touch-none select-none rounded px-0.5 transition-colors [-webkit-touch-callout:none] hover:bg-yellow-100 dark:hover:bg-yellow-900/40"
                        >
                          {tok.text}
                        </button>
                      );
                    })}{" "}
                  </span>
                );
              })}
            </article>
          )}

          {boundaryHint && (
            <div className="pointer-events-none fixed inset-x-0 bottom-20 z-20 flex justify-center px-5">
              <div className="rounded-full bg-black/80 px-4 py-2 text-xs text-white dark:bg-white/90 dark:text-black">
                Фразу можно выделить только в пределах одного предложения
              </div>
            </div>
          )}

          {finishError && (
            <div className="px-5 pb-1 pt-3 text-center text-sm text-[var(--color-danger)]" role="alert">
              {finishError}
            </div>
          )}

          <footer className="sticky bottom-0 z-10 mt-4 -mx-4 border-t border-black/[0.07] bg-[#f7f4ee]/95 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-background/95 sm:-mx-6 sm:px-6">
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between">
              <button
                type="button"
                disabled={pageIndex === 0 && !chapter?.prevTextId}
                onClick={() => {
                  if (pageIndex > 0) setPageIndex((i) => i - 1);
                  else goPrevChapter();
                }}
                className="focus-ring flex min-h-11 min-w-24 items-center justify-center rounded-full px-4 text-sm font-semibold text-[var(--color-forest-text)] transition-colors hover:bg-black/[0.04] disabled:opacity-30 dark:hover:bg-white/[0.06]"
              >
                {pageIndex === 0 && chapter?.prevTextId ? "← Часть назад" : "← Назад"}
              </button>
              <span className="rounded-full bg-black/[0.04] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)] dark:bg-white/[0.07]">
                {readingProgress}%
              </span>
              {pageIndex < pages.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
                  className="focus-ring flex min-h-11 min-w-24 items-center justify-center rounded-full bg-[var(--color-forest)] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-forest-deep)]"
                >
                  Далее →
                </button>
              ) : chapter?.nextTextId ? (
                <button
                  type="button"
                  onClick={goNextChapter}
                  className="focus-ring flex min-h-11 min-w-24 items-center justify-center rounded-full bg-[var(--color-forest)] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[var(--color-forest-deep)]"
                >
                  Часть далее →
                </button>
              ) : (
                <button
                  type="button"
                  disabled={finishing}
                  onClick={handleFinish}
                  className="focus-ring flex min-h-11 items-center justify-center rounded-full bg-[var(--color-success-text)]/15 px-4 text-sm font-bold text-[var(--color-success-text)] disabled:opacity-50"
                >
                  {finishing ? "…" : "Завершить ✓"}
                </button>
              )}
            </div>
          </footer>
        </main>

        {!focusMode && (
          <aside className="hidden w-full shrink-0 flex-col gap-4 lg:flex lg:w-[340px]">
            {mode === "listening" && (
              <div className="rounded-2xl bg-[var(--surface-muted)] p-4">
                <ReaderListening
                  supported={listening.supported}
                  playing={listening.playing}
                  rate={listening.rate}
                  onRateChange={listening.setRate}
                  onPlay={() => {
                    track("listening_started");
                    listening.play();
                  }}
                  onPause={listening.pause}
                  onStop={listening.stop}
                />
              </div>
            )}
            {popup ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
                <ReaderWordPanel
                  popup={popup}
                  manualTranslation={manualTranslation}
                  onManualTranslationChange={setManualTranslation}
                  onManualTranslationSubmit={handleManualTranslation}
                  onSpeak={handleSpeak}
                  onSetLevel={handleSetLevel}
                  onAddPhrase={handleAddPhrase}
                  onClose={() => setPopup(null)}
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border-strong)] p-4 text-center text-sm text-[var(--text-secondary)]">
                Нажми на слово в тексте, чтобы посмотреть перевод
              </div>
            )}
            <p className="text-xs text-[var(--text-secondary)]">
              ⌨️ ← → — страница/часть · F — Focus · Esc — закрыть панель
              {mode === "listening" ? " · Space — пауза/воспр." : ""}
            </p>
          </aside>
        )}
      </div>

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
              onClose={() => setPopup(null)}
            />
          </div>
        </div>
      )}

      {mode === "listening" && !popup && (
        <div className="fixed inset-x-4 bottom-4 z-20 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xl lg:hidden">
          <ReaderListening
            supported={listening.supported}
            playing={listening.playing}
            rate={listening.rate}
            onRateChange={listening.setRate}
            onPlay={() => {
              track("listening_started");
              listening.play();
            }}
            onPause={listening.pause}
            onStop={listening.stop}
          />
        </div>
      )}

      {settingsOpen && (
        <ReaderSettings
          prefs={readerPrefs}
          onChange={updateReaderPrefs}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
