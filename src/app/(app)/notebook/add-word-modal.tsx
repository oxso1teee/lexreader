"use client";

import { useEffect, useRef, useState } from "react";
import { addManualWord } from "./actions";
import MicButton from "@/components/mic-button";

export default function AddWordModal({
  sourceLang,
  targetLang,
}: {
  sourceLang: string;
  targetLang: string;
}) {
  const [open, setOpen] = useState(false);
  const [headword, setHeadword] = useState("");
  const [translation, setTranslation] = useState("");
  const [note, setNote] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState(false);
  const translationEditedRef = useRef(false);

  useEffect(() => {
    if (!headword.trim() || translationEditedRef.current) return;
    const timer = setTimeout(async () => {
      setSuggesting(true);
      try {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ word: headword.trim(), sourceLang, targetLang }),
        });
        const data = await res.json();
        if (res.ok && !translationEditedRef.current) {
          setTranslation(data.wordTranslation ?? "");
        }
      } catch {
        // подсказка необязательна — просто не показываем её
      } finally {
        setSuggesting(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [headword, sourceLang, targetLang]);

  function reset() {
    setHeadword("");
    setTranslation("");
    setNote("");
    setError(null);
    setPaywall(false);
    translationEditedRef.current = false;
  }

  async function handleSave() {
    if (!headword.trim() || !translation.trim()) return;
    setBusy(true);
    setError(null);
    setPaywall(false);
    const result = await addManualWord({
      headword: headword.trim(),
      translation: translation.trim(),
      note: note.trim() || undefined,
    });
    setBusy(false);
    if (!result.ok) {
      if (result.paywall) setPaywall(true);
      else setError(result.error ?? "Не удалось сохранить слово.");
      return;
    }
    setOpen(false);
    reset();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Добавить слово вручную"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-caramel text-lg font-medium text-white"
      >
        +
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 px-6">
      <div className="w-full max-w-sm rounded-2xl bg-card p-5">
        <h2 className="mb-4 text-center text-lg font-bold">Добавить слово</h2>

        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-black/50 dark:text-white/50">Слово или фраза</span>
            <div className="flex items-center gap-1 rounded-lg border border-black/15 pr-1 focus-within:border-black/40 dark:border-white/20 dark:focus-within:border-white/40">
              <input
                type="text"
                autoFocus
                value={headword}
                onChange={(e) => setHeadword(e.target.value)}
                placeholder="Например: serendipity или figure out"
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
              />
              <MicButton lang={sourceLang} onResult={(text) => setHeadword(text)} />
            </div>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-black/50 dark:text-white/50">
              Перевод {suggesting && "· подбираем…"}
            </span>
            <div className="flex items-center gap-1 rounded-lg border border-black/15 pr-1 focus-within:border-black/40 dark:border-white/20 dark:focus-within:border-white/40">
              <input
                type="text"
                value={translation}
                onChange={(e) => {
                  translationEditedRef.current = true;
                  setTranslation(e.target.value);
                }}
                placeholder="Перевод"
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
              />
              <MicButton
                lang={targetLang}
                onResult={(text) => {
                  translationEditedRef.current = true;
                  setTranslation(text);
                }}
              />
            </div>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="text-black/50 dark:text-white/50">Заметка (необязательно)</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Где услышал / контекст"
              className="rounded-lg border border-black/15 px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/40"
            />
          </label>

          {paywall && (
            <p className="text-sm text-black/60 dark:text-white/60">
              Бесплатный лимит слов на сегодня исчерпан.
            </p>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                reset();
              }}
              className="flex-1 rounded-full bg-black/10 py-2.5 font-medium dark:bg-white/10"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={busy || !headword.trim() || !translation.trim()}
              onClick={handleSave}
              className="flex-1 rounded-full bg-caramel py-2.5 font-medium text-white disabled:opacity-50"
            >
              {busy ? "…" : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
