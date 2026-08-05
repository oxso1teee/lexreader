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

// P0-АУДИТ 3.12 (испр.): answerOf() определяет, какая сторона карточки
// сейчас считается "ответом" — с учётом направления изучения, а не всегда
// card.back (единственный режим, который уже был согласован с
// направлением, но не переиспользовал общую функцию).
function answerOf(card: ReviewCard, studyDirection: "front_back" | "back_front"): string {
  return studyDirection === "back_front" ? card.front : card.back;
}
function questionOf(card: ReviewCard, studyDirection: "front_back" | "back_front"): string {
  return studyDirection === "back_front" ? card.back : card.front;
}

function buildOptions(cards: ReviewCard[], studyDirection: "front_back" | "back_front"): string[][] {
  return cards.map((card) => {
    const answer = answerOf(card, studyDirection);
    const distractorPool = cards.filter(
      (c) => c.flashcardId !== card.flashcardId && answerOf(c, studyDirection) !== answer,
    );
    const distractors = shuffle(distractorPool)
      .slice(0, 3)
      .map((c) => answerOf(c, studyDirection));
    return shuffle([answer, ...distractors]);
  });
}

export default function MultipleChoiceMode({
  cards,
  studyDirection,
}: {
  cards: ReviewCard[];
  studyDirection: "front_back" | "back_front";
}) {
  // Варианты для всех карточек считаем один раз при монтировании — стабильны
  // на всю сессию, без пересчёта по эффекту при смене index.
  const [allOptions] = useState(() => buildOptions(cards, studyDirection));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const done = index >= cards.length;
  const card = cards[index];
  const options = allOptions[index] ?? [];

  if (done) {
    return <SessionComplete count={cards.length} />;
  }

  // P0-АУДИТ (раздел 4): при малом числе карточек в сессии (частый случай в
  // первый день) неоткуда брать неправильные варианты — "квиз" из одной
  // кнопки ничего не проверяет. Честно предлагаем другой режим вместо этого.
  if (options.length < 2) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-2 px-5 text-center">
        <p className="text-xl font-semibold">Пока маловато карточек</p>
        <p className="text-black/60 dark:text-white/60">
          Для режима &laquo;Выбор&raquo; нужно больше карточек, чтобы было из чего выбирать.
          Попробуй режим &laquo;Карточки&raquo; или добавь ещё слов.
        </p>
      </div>
    );
  }

  function choose(option: string) {
    if (selected) return;
    setSelected(option);
    const grade = option === answerOf(card, studyDirection) ? 2 : 0;
    startTransition(() => {
      void reviewWord(card.flashcardId, grade);
    });
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
        <p className="text-2xl font-semibold">{questionOf(card, studyDirection)}</p>
      </div>

      <div className="flex flex-col gap-2">
        {options.map((opt) => {
          const isCorrect = opt === answerOf(card, studyDirection);
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
