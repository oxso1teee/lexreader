"use client";

import { useState, useTransition } from "react";
import { reviewWord } from "./actions";
import type { ReviewCard } from "./review-session";
import SessionComplete from "./session-complete";

export default function TypeWordMode({ cards }: { cards: ReviewCard[] }) {
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [isPending, startTransition] = useTransition();

  const done = index >= cards.length;
  const card = cards[index];

  if (done) {
    return <SessionComplete count={cards.length} />;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (result) {
      setIndex((i) => i + 1);
      setValue("");
      setResult(null);
      return;
    }

    const isCorrect = value.trim().toLowerCase() === card.front.trim().toLowerCase();
    setResult(isCorrect ? "correct" : "wrong");
    startTransition(() => reviewWord(card.flashcardId, isCorrect ? 2 : 0));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8"
    >
      <p className="mb-4 text-sm text-black/50 dark:text-white/50">
        {index + 1} / {cards.length}
      </p>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="text-2xl font-semibold">{card.back}</p>
        {result && (
          <p
            className={
              result === "correct"
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }
          >
            {result === "correct" ? "Верно!" : `Правильный ответ: ${card.front}`}
          </p>
        )}
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={!!result}
        autoFocus
        placeholder="Напиши слово на изучаемом языке"
        className="mb-4 w-full rounded-lg border border-black/10 px-4 py-2.5 text-base outline-none focus:border-black/30 disabled:opacity-60 dark:border-white/15 dark:focus:border-white/40"
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
