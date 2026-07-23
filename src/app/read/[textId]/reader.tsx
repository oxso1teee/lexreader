"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { splitIntoSentences, tokenizeSentence } from "@/lib/tokenize";
import { WORD_LEVELS } from "@/lib/types";
import { log } from "@/lib/log";
import {
  upsertWord,
  setWordLevel,
  addPhraseToDefaultDeck,
  finishReading,
  updateTextProgress,
} from "./actions";

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

interface Popup {
  isPhrase: boolean;
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
  saved?: boolean;
}

const WORDS_PER_PAGE = 140;

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
}: {
  textId: string;
  title: string;
  body: string;
  sourceLang: string;
  targetLang: string;
  wordLevels: Record<string, WordLevelInfo>;
  stats: Stats;
  initialPageIndex?: number;
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

  async function runLookup(text: string, sentence: string, isPhrase: boolean) {
    setPopup({ isPhrase, text, sentence, loading: true });
    setManualTranslation("");
    setWordsLookedUp((n) => n + 1);

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

  async function handleAddPhrase() {
    if (!popup?.wordTranslation) return;
    const result = await addPhraseToDefaultDeck(popup.text, popup.wordTranslation);
    if (!result.ok) {
      setPopup({ ...popup, paywall: result.paywall, error: result.paywall ? undefined : result.error });
      return;
    }
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

  const currentPageText = sentences.slice(pageStart, pageEnd).join(" ");

  return (
    <div className="relative flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-black/10 bg-background/95 px-4 py-3 backdrop-blur dark:border-white/10">
        <Link href="/library" className="shrink-0 text-sm font-medium text-caramel">
          ← Библиотека
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-medium">{title}</h1>
          <p className="text-xs text-black/40 dark:text-white/40">{wordsLookedUp}w</p>
        </div>
        <button
          type="button"
          onClick={() => handleSpeak(currentPageText)}
          aria-label="Озвучить страницу"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white"
        >
          🎤
        </button>
        <button
          type="button"
          onClick={handleFinish}
          disabled={finishing}
          aria-label="Завершить чтение"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-red-400 text-red-500 disabled:opacity-50"
        >
          ✕
        </button>
      </header>

      <div className="mx-auto grid w-full max-w-2xl grid-cols-5 gap-2 px-5 pt-4 text-center text-sm">
        <div>
          <p className="font-bold">{stats.unique}</p>
          <p className="text-xs text-black/40 dark:text-white/40">ВСЕГО</p>
        </div>
        <div>
          <p className="font-bold text-accent-orange">{stats.new}</p>
          <p className="text-xs text-black/40 dark:text-white/40">НОВЫЕ</p>
        </div>
        <div>
          <p className="font-bold text-orange-400">{stats.learning}</p>
          <p className="text-xs text-black/40 dark:text-white/40">УЧУ</p>
        </div>
        <div>
          <p className="font-bold text-orange-300">{stats.familiar}</p>
          <p className="text-xs text-black/40 dark:text-white/40">ЗНАКОМЫЕ</p>
        </div>
        <div>
          <p className="font-bold text-accent-green">{stats.known}</p>
          <p className="text-xs text-black/40 dark:text-white/40">ЗНАЮ</p>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center gap-3 px-5 pt-2 text-xs text-black/50 dark:text-white/50">
        {WORD_LEVELS.map((l) => (
          <span key={l.level} className="flex items-center gap-1">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: l.color }}
            />
            {l.label}
          </span>
        ))}
        <span className="ml-auto italic">Удерживай, чтобы выделить фразу</span>
      </div>

      <article className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 text-lg leading-8">
        {sentences.slice(pageStart, pageEnd).map((sentence, localIdx) => {
          const si = pageStart + localIdx;
          return (
            <span key={si}>
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
                    className="touch-none select-none rounded px-0.5 transition-colors [-webkit-touch-callout:none] hover:bg-yellow-100 dark:hover:bg-yellow-900/40"
                  >
                    {tok.text}
                  </button>
                );
              })}{" "}
            </span>
          );
        })}
      </article>

      {boundaryHint && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-20 flex justify-center px-5">
          <div className="rounded-full bg-black/80 px-4 py-2 text-xs text-white dark:bg-white/90 dark:text-black">
            Фразу можно выделить только в пределах одного предложения
          </div>
        </div>
      )}

      {finishError && (
        <div className="px-5 pb-1 text-center text-sm text-red-600 dark:text-red-400">
          {finishError}
        </div>
      )}
      <footer className="sticky bottom-0 flex items-center justify-between border-t border-black/10 bg-background/95 px-5 py-3 backdrop-blur dark:border-white/10">
        <button
          type="button"
          disabled={pageIndex === 0}
          onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
          className="text-sm font-medium text-caramel disabled:opacity-30"
        >
          ← Назад
        </button>
        <span className="text-sm text-black/50 dark:text-white/50">
          {pageIndex + 1} / {pages.length}
        </span>
        {pageIndex < pages.length - 1 ? (
          <button
            type="button"
            onClick={() => setPageIndex((i) => Math.min(pages.length - 1, i + 1))}
            className="text-sm font-medium text-caramel"
          >
            Далее →
          </button>
        ) : (
          <button
            type="button"
            disabled={finishing}
            onClick={handleFinish}
            className="flex min-h-11 items-center justify-center rounded-full bg-emerald-100 px-4 text-sm font-medium text-emerald-800 disabled:opacity-50 dark:bg-emerald-900 dark:text-emerald-200"
          >
            {finishing ? "…" : "Завершить ✓"}
          </button>
        )}
      </footer>

      {popup && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-black/10 bg-card p-5 shadow-2xl dark:border-white/10">
          <div className="mx-auto flex max-w-2xl flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold">{popup.text}</p>
                  <button
                    type="button"
                    onClick={() => handleSpeak(popup.text)}
                    aria-label="Озвучить"
                    className="text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white"
                  >
                    ▶
                  </button>
                  {popup.isPhrase && (
                    <span className="rounded-full bg-black/10 px-2 py-0.5 text-xs dark:bg-white/15">
                      phrase
                    </span>
                  )}
                </div>

                {popup.loading ? (
                  <p className="text-black/50 dark:text-white/50">Переводим…</p>
                ) : popup.paywall ? (
                  <p className="text-black/60 dark:text-white/60">
                    {popup.isPhrase
                      ? "Бесплатный лимит карточек в Мозге исчерпан."
                      : "Бесплатный лимит слов на сегодня исчерпан."}{" "}
                    <Link
                      href={`/pricing?reason=${popup.isPhrase ? "cards" : "words"}`}
                      className="text-caramel underline"
                    >
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
                        + Добавить перевод
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-black/80 dark:text-white/80">{popup.wordTranslation}</p>
                    {popup.sentenceTranslation && (
                      <p className="mt-1 text-sm text-black/50 dark:text-white/50">
                        {popup.sentenceTranslation}
                      </p>
                    )}
                    {!popup.isPhrase && popup.level !== undefined && (
                      <p className="mt-1 text-sm text-black/50 dark:text-white/50">
                        {WORD_LEVELS[popup.level].label} · Видел {popup.seenCount}×
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

            {!popup.isPhrase && popup.vocabId && (
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
                      className="flex min-h-11 items-center justify-center rounded-lg text-sm font-medium"
                    >
                      {l.level}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!popup.loading && !popup.error && !popup.paywall && (
              <div className="grid grid-cols-4 gap-2">
                {popup.isPhrase ? (
                  <button
                    type="button"
                    onClick={handleAddPhrase}
                    disabled={popup.saved}
                    className="flex min-h-11 items-center justify-center rounded-lg bg-caramel px-2 text-center text-xs font-medium text-white disabled:opacity-60"
                  >
                    {popup.saved ? "Добавлено ✓" : "+ В карточки"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSetLevel(4)}
                    className="flex min-h-11 items-center justify-center rounded-lg px-2 text-center text-xs font-medium text-white"
                    style={{ backgroundColor: popup.level === 4 ? WORD_LEVELS[4].color : "#a67c52" }}
                  >
                    {popup.level === 4 ? "Добавлено ✓" : "Знаю это слово ⭐"}
                  </button>
                )}
                <Link
                  href="/pricing"
                  className="flex min-h-11 items-center justify-center rounded-lg border border-black/10 px-2 text-center text-xs font-medium dark:border-white/15"
                >
                  💬 В контексте ⭐
                </Link>
                <Link
                  href="/pricing"
                  className="flex min-h-11 items-center justify-center rounded-lg border border-black/10 px-2 text-center text-xs font-medium dark:border-white/15"
                >
                  📖 Подробно ⭐
                </Link>
                <Link
                  href="/pricing"
                  className="flex min-h-11 items-center justify-center rounded-lg border border-black/10 px-2 text-center text-xs font-medium dark:border-white/15"
                >
                  ✏️ Грамматика ⭐
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
