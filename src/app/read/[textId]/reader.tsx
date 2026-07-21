"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { splitIntoSentences, tokenizeSentence } from "@/lib/tokenize";
import { saveWord, finishReading } from "./actions";

interface Popup {
  word: string;
  sentence: string;
  loading: boolean;
  wordTranslation?: string;
  sentenceTranslation?: string | null;
  error?: string;
  saved?: boolean;
  paywall?: boolean;
}

export default function Reader({
  textId,
  title,
  body,
  sourceLang,
  targetLang,
  initialSavedHeadwords,
}: {
  textId: string;
  title: string;
  body: string;
  sourceLang: string;
  targetLang: string;
  initialSavedHeadwords: string[];
}) {
  const router = useRouter();
  const sentences = useMemo(() => splitIntoSentences(body), [body]);
  const [savedWords, setSavedWords] = useState(() => new Set(initialSavedHeadwords));
  const [popup, setPopup] = useState<Popup | null>(null);
  const [wordsLookedUp, setWordsLookedUp] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  async function handleWordTap(word: string, sentence: string) {
    setPopup({ word, sentence, loading: true });
    setWordsLookedUp((n) => n + 1);

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ word, sentence, sourceLang, targetLang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Ошибка перевода");

      setPopup({
        word,
        sentence,
        loading: false,
        wordTranslation: data.wordTranslation,
        sentenceTranslation: data.sentenceTranslation,
      });
    } catch (e) {
      setPopup({
        word,
        sentence,
        loading: false,
        error: e instanceof Error ? e.message : "Ошибка перевода",
      });
    }
  }

  async function handleSave() {
    if (!popup || popup.loading || popup.error || !popup.wordTranslation) return;

    const result = await saveWord({
      textId,
      headword: popup.word,
      translation: popup.wordTranslation,
      contextSentence: popup.sentence,
      contextTranslation: popup.sentenceTranslation ?? null,
    });

    if (!result.ok) {
      setPopup((p) =>
        p ? { ...p, paywall: result.paywall, error: result.paywall ? undefined : result.error } : p,
      );
      return;
    }

    setSavedWords((s) => new Set(s).add(popup.word.toLowerCase()));
    setPopup((p) => (p ? { ...p, saved: true } : p));
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
    const elapsed = Date.now() - (startedAt.current ?? Date.now());
    const minutes = Math.max(1, Math.round(elapsed / 60_000));
    try {
      await finishReading({ textId, minutes, wordsLookedUp });
    } finally {
      router.push("/library");
    }
  }

  return (
    <div className="relative flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-black/10 bg-white/90 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-black/90">
        <h1 className="truncate pr-3 text-base font-medium">{title}</h1>
        <button
          type="button"
          onClick={handleFinish}
          disabled={finishing}
          className="shrink-0 rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {finishing ? "…" : "Готово"}
        </button>
      </header>

      <article className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 text-lg leading-8">
        {sentences.map((sentence, si) => (
          <span key={si}>
            {tokenizeSentence(sentence).map((tok, ti) =>
              tok.isWord ? (
                <button
                  key={ti}
                  type="button"
                  onClick={() => handleWordTap(tok.text, sentence)}
                  className={`rounded px-0.5 transition-colors hover:bg-yellow-100 dark:hover:bg-yellow-900/40 ${
                    savedWords.has(tok.text.toLowerCase())
                      ? "underline decoration-2 decoration-emerald-500 underline-offset-4"
                      : ""
                  }`}
                >
                  {tok.text}
                </button>
              ) : (
                <span key={ti}>{tok.text}</span>
              ),
            )}{" "}
          </span>
        ))}
      </article>

      {popup && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-black/10 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-2xl flex-col gap-2">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold">{popup.word}</p>
                  <button
                    type="button"
                    onClick={() => handleSpeak(popup.word)}
                    aria-label="Озвучить"
                    className="text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white"
                  >
                    🔊
                  </button>
                </div>
                {popup.loading ? (
                  <p className="text-black/50 dark:text-white/50">Переводим…</p>
                ) : popup.paywall ? (
                  <p className="text-black/60 dark:text-white/60">
                    Бесплатный лимит слов на сегодня исчерпан.{" "}
                    <Link href="/paywall?reason=words" className="underline">
                      Смотреть Premium
                    </Link>
                  </p>
                ) : popup.error ? (
                  <p className="text-red-600 dark:text-red-400">{popup.error}</p>
                ) : (
                  <>
                    <p className="text-black/80 dark:text-white/80">{popup.wordTranslation}</p>
                    {popup.sentenceTranslation && (
                      <p className="mt-1 text-sm text-black/50 dark:text-white/50">
                        {popup.sentenceTranslation}
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
            {!popup.paywall && (
              <button
                type="button"
                onClick={handleSave}
                disabled={popup.loading || !!popup.error || popup.saved}
                className="mt-2 rounded-full bg-black px-4 py-2.5 font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
              >
                {popup.saved ? "Сохранено ✓" : "+ В словарь"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
