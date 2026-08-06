"use client";

import { useState, useTransition } from "react";
import { reviewWord } from "./actions";
import type { ReviewCard } from "./review-session";
import SessionComplete from "./session-complete";

export default function TypeWordMode({
  cards,
  studyDirection,
}: {
  cards: ReviewCard[];
  studyDirection: "front_back" | "back_front";
}) {
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [isPending, startTransition] = useTransition();

  const done = index >= cards.length;
  const card = cards[index];
  // P0-АУДИТ 3.12 (испр.): было жёстко "вопрос = back, ответ = front" —
  // при направлении по умолчанию показывало перевод и просило напечатать
  // слово, хотя "Слово → Перевод" подразумевает обратное.
  const question = studyDirection === "back_front" ? card?.back : card?.front;
  const answer = studyDirection === "back_front" ? card?.front : card?.back;

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

    const isCorrect = value.trim().toLowerCase() === answer.trim().toLowerCase();
    setResult(isCorrect ? "correct" : "wrong");
    startTransition(() => {
      void reviewWord(card.flashcardId, isCorrect ? 2 : 0);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8"
    >
      <p className="mb-4 text-sm text-[var(--text-secondary)]">
        {index + 1} / {cards.length}
      </p>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="text-2xl font-semibold">{question}</p>
        {/* M3 Slice 4.1: уже была текстовая подпись, отличная по состоянию —
            добавляем иконку, role/aria-live для озвучки скринридером и
            небольшую цветовую поддержку на самом поле ввода, не трогая
            логику проверки/грейдинга ниже. */}
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
            {result === "correct" ? "Верно!" : `Правильный ответ: ${answer}`}
          </p>
        )}
      </div>

      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={!!result}
        autoFocus
        placeholder={
          studyDirection === "back_front" ? "Напиши слово на изучаемом языке" : "Напиши перевод"
        }
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
