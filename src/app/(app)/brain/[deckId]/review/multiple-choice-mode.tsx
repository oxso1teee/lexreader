"use client";

import { useState, useTransition } from "react";
import { reviewWord } from "./actions";
import type { ReviewCard } from "./review-session";
import SessionComplete from "./session-complete";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildOptions(cards: ReviewCard[]): string[][] {
  return cards.map((card) => {
    const distractorPool = cards.filter(
      (c) => c.flashcardId !== card.flashcardId && c.back !== card.back,
    );
    const distractors = shuffle(distractorPool)
      .slice(0, 3)
      .map((c) => c.back);
    return shuffle([card.back, ...distractors]);
  });
}

export default function MultipleChoiceMode({ cards }: { cards: ReviewCard[] }) {
  // Варианты для всех карточек считаем один раз при монтировании — стабильны
  // на всю сессию, без пересчёта по эффекту при смене index.
  const [allOptions] = useState(() => buildOptions(cards));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const done = index >= cards.length;
  const card = cards[index];
  const options = allOptions[index] ?? [];

  if (done) {
    return <SessionComplete count={cards.length} />;
  }

  function choose(option: string) {
    if (selected) return;
    setSelected(option);
    const grade = option === card.back ? 2 : 0;
    startTransition(() => reviewWord(card.flashcardId, grade));
  }

  function next() {
    setSelected(null);
    setIndex((i) => i + 1);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
      <p className="mb-4 text-sm text-black/50 dark:text-white/50">
        {index + 1} / {cards.length}
      </p>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="text-2xl font-semibold">{card.front}</p>
      </div>

      <div className="flex flex-col gap-2">
        {options.map((opt) => {
          const isCorrect = opt === card.back;
          const showState = selected !== null;
          const stateClass = !showState
            ? "border-black/10 hover:border-black/30 dark:border-white/15 dark:hover:border-white/40"
            : isCorrect
              ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950"
              : opt === selected
                ? "border-red-500 bg-red-50 dark:bg-red-950"
                : "border-black/10 opacity-50 dark:border-white/15";
          return (
            <button
              key={opt}
              type="button"
              disabled={showState}
              onClick={() => choose(opt)}
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${stateClass}`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <button
          type="button"
          disabled={isPending}
          onClick={next}
          className="mt-4 rounded-full bg-black px-5 py-3 font-medium text-white dark:bg-white dark:text-black"
        >
          Далее
        </button>
      )}
    </div>
  );
}
