"use client";

import { useState, useTransition } from "react";
import { motion, useReducedMotion } from "motion/react";
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
  missionId = null,
}: {
  cards: ReviewCard[];
  studyDirection: "front_back" | "back_front";
  missionId?: string | null;
}) {
  // Варианты для всех карточек считаем один раз при монтировании — стабильны
  // на всю сессию, без пересчёта по эффекту при смене index.
  const [allOptions] = useState(() => buildOptions(cards, studyDirection));
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Реальный per-card grade (2/0), тот же, что уходит в reviewWord() ниже —
  // не отдельная метрика, а просто накопленный счёт для миссии (§11-13).
  const [tally, setTally] = useState({ correct: 0, incorrect: 0 });
  const reduceMotion = useReducedMotion();

  const done = index >= cards.length;
  const card = cards[index];
  const options = allOptions[index] ?? [];

  if (done) {
    return (
      <SessionComplete
        count={cards.length}
        missionId={missionId}
        missionCorrectCount={tally.correct}
        missionIncorrectCount={tally.incorrect}
      />
    );
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
    const isCorrect = option === answerOf(card, studyDirection);
    const grade = isCorrect ? 2 : 0;
    setTally((t) => (isCorrect ? { ...t, correct: t.correct + 1 } : { ...t, incorrect: t.incorrect + 1 }));
    startTransition(() => {
      void reviewWord(card.flashcardId, grade, "choice");
    });
  }

  function next() {
    setSelected(null);
    setIndex((i) => i + 1);
  }

  const correctAnswer = answerOf(card, studyDirection);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
      <p className="mb-4 text-sm text-[var(--text-secondary)]">
        {index + 1} / {cards.length}
      </p>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="text-2xl font-semibold">{questionOf(card, studyDirection)}</p>
      </div>

      {/* M3 Slice 4.1: результат раньше отличался только цветом рамки/фона —
          добавляем иконку, текстовую подпись и озвучку для скринридера, не
          трогая саму логику выбора/грейдинга ниже. */}
      {selected !== null && (
        <p role="status" aria-live="polite" className="sr-only">
          {selected === correctAnswer ? "Верно!" : `Неверно. Правильный ответ: ${correctAnswer}`}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {options.map((opt) => {
          const isCorrect = opt === correctAnswer;
          const showState = selected !== null;
          const isSelectedWrong = showState && opt === selected && !isCorrect;
          const stateClass = !showState
            ? "border-black/10 hover:border-black/30 dark:border-white/15 dark:hover:border-white/40"
            : isCorrect
              ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950"
              : isSelectedWrong
                ? "border-red-500 bg-red-50 dark:bg-red-950"
                : "border-black/10 opacity-50 dark:border-white/15";
          return (
            <motion.button
              key={opt}
              type="button"
              disabled={showState}
              onClick={() => choose(opt)}
              // Микро-пульс на правильном варианте в момент раскрытия — без
              // задержки (следующая карточка доступна сразу через кнопку
              // "Далее" ниже, эта анимация ничего не блокирует).
              animate={showState && isCorrect && !reduceMotion ? { scale: [1, 1.035, 1] } : { scale: 1 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className={`flex items-center justify-between gap-2 rounded-lg border px-4 py-3 text-left transition-colors ${stateClass}`}
            >
              <span>{opt}</span>
              {showState && isCorrect && (
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <span aria-hidden="true">✓</span> Верно
                </span>
              )}
              {isSelectedWrong && (
                <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400">
                  <span aria-hidden="true">✗</span> Неверно
                </span>
              )}
            </motion.button>
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
