"use client";

import { useEffect, useState, useTransition } from "react";
import { reviewWord, getContextGapCards, type ContextGapCard } from "./actions";
import type { ReviewCard } from "./review-session";
import SessionComplete from "./session-complete";

// M3 Slice 10 (brief Phase C §14, task #277) — "Context Gap": the target word/phrase is blanked
// out of a real sentence the user already saved (from Reader, manual add, or import), typed from
// memory. Unlike the other four modes, eligibility isn't "every due card" — only cards with a
// saved context where the word appears exactly once qualify (see getContextGapCards/
// buildContextGapBlank) — so the eligible set is fetched lazily on mount rather than baked into
// the shared `cards` query every mode gets.
//
// Tagged practice_mode: "type" when graded (brief §14 left this an implementation decision) —
// honestly a typed-recall test, arguably a stronger one than bare Type mode since it requires
// producing the word from meaning-in-context rather than a bare translation prompt. Reusing
// "type" avoids a second migration to widen review_log.practice_mode's check constraint for a
// evidence tier the state engine would treat identically anyway (see STRONG_RECALL_MODES in
// state-engine.ts).
export default function ContextGapMode({
  cards,
  missionId = null,
}: {
  cards: ReviewCard[];
  missionId?: string | null;
}) {
  const [items, setItems] = useState<ContextGapCard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [isPending, startTransition] = useTransition();
  const [tally, setTally] = useState({ correct: 0, incorrect: 0 });

  useEffect(() => {
    let cancelled = false;
    getContextGapCards(cards.map((c) => c.flashcardId)).then((result) => {
      if (!cancelled) setItems(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cards is a stable snapshot, see review-mode-switcher.tsx
  }, []);

  if (items === null) {
    return (
      <p className="flex flex-1 items-center justify-center px-5 text-[var(--text-secondary)]">
        Загрузка…
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 text-center">
        <p className="text-xl font-semibold">Пока нет карточек для этого режима</p>
        <p className="text-black/60 dark:text-white/60">
          «Контекст» работает со словами, у которых сохранено предложение и слово в нём встречается
          ровно один раз. Сохраняй слова во время чтения — и они появятся здесь.
        </p>
      </div>
    );
  }

  const done = index >= items.length;
  const item = items[index];

  if (done) {
    return (
      <SessionComplete
        count={items.length}
        missionId={missionId}
        missionCorrectCount={tally.correct}
        missionIncorrectCount={tally.incorrect}
      />
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (result) {
      setIndex((i) => i + 1);
      setValue("");
      setResult(null);
      return;
    }

    const isCorrect = value.trim().toLowerCase() === item.front.trim().toLowerCase();
    setResult(isCorrect ? "correct" : "wrong");
    setTally((t) => (isCorrect ? { ...t, correct: t.correct + 1 } : { ...t, incorrect: t.incorrect + 1 }));
    startTransition(() => {
      void reviewWord(item.flashcardId, isCorrect ? 2 : 0, "type");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
      <p className="mb-4 text-sm text-[var(--text-secondary)]">
        {index + 1} / {items.length}
      </p>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="text-lg leading-relaxed">
          {item.before}
          <span
            className={`mx-1 inline-block min-w-16 border-b-2 px-1 font-semibold ${
              result === "correct"
                ? "border-emerald-600 text-emerald-700 dark:border-emerald-500 dark:text-emerald-400"
                : result === "wrong"
                  ? "border-red-500 text-red-600 dark:text-red-400"
                  : "border-black/40 dark:border-white/40"
            }`}
          >
            {result ? item.blanked : " "}
          </span>
          {item.after}
        </p>
        {result && item.contextTranslation && (
          <p className="text-sm text-[var(--text-secondary)]">{item.contextTranslation}</p>
        )}
        {result && (
          <p
            role="status"
            aria-live="polite"
            className={`flex items-center gap-1.5 font-medium ${
              result === "correct"
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            <span aria-hidden="true">{result === "correct" ? "✓" : "✗"}</span>
            {result === "correct" ? "Верно!" : `Правильный ответ: ${item.front}`}
          </p>
        )}
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={!!result}
        autoFocus
        placeholder="Впиши пропущенное слово"
        className={`mb-4 w-full rounded-lg border px-4 py-2.5 text-base outline-none focus:border-black/30 disabled:opacity-60 dark:focus:border-white/40 ${
          result === "correct"
            ? "border-emerald-600 dark:border-emerald-500"
            : result === "wrong"
              ? "border-red-500 dark:border-red-500"
              : "border-black/10 dark:border-white/15"
        }`}
      />

      <button
        type="submit"
        disabled={isPending || (!result && value.trim() === "")}
        className="rounded-full bg-black px-5 py-3 font-medium text-white disabled:opacity-40 dark:bg-white dark:text-black"
      >
        {result ? "Далее" : "Проверить"}
      </button>
    </form>
  );
}
