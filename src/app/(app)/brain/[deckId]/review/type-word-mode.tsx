"use client";

import { useState, useTransition } from "react";
import { motion, useReducedMotion } from "motion/react";
import { reviewWord } from "./actions";
import type { ReviewCard } from "./review-session";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import SessionComplete from "./session-complete";

export default function TypeWordMode({
  cards,
  studyDirection,
  missionId = null,
}: {
  cards: ReviewCard[];
  studyDirection: "front_back" | "back_front";
  missionId?: string | null;
}) {
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [isPending, startTransition] = useTransition();
  // Реальный per-card результат, тот же, что уходит в reviewWord() ниже —
  // накопленный счёт для миссии (§11-13), не отдельная метрика.
  const [tally, setTally] = useState({ correct: 0, incorrect: 0 });
  const reduceMotion = useReducedMotion();

  const done = index >= cards.length;
  const card = cards[index];
  // P0-АУДИТ 3.12 (испр.): было жёстко "вопрос = back, ответ = front" —
  // при направлении по умолчанию показывало перевод и просило напечатать
  // слово, хотя "Слово → Перевод" подразумевает обратное.
  const question = studyDirection === "back_front" ? card?.back : card?.front;
  const answer = studyDirection === "back_front" ? card?.front : card?.back;

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
    setTally((t) => (isCorrect ? { ...t, correct: t.correct + 1 } : { ...t, incorrect: t.incorrect + 1 }));
    startTransition(() => {
      void reviewWord(card.flashcardId, isCorrect ? 2 : 0, "type");
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
          <motion.p
            role="status"
            aria-live="polite"
            initial={reduceMotion ? false : { scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            // Быстро и без задержки — тот же spring, что и в session-complete.tsx,
            // но короче: следующая карточка не должна ждать анимацию, кнопка
            // "Далее" кликабельна сразу же, это чисто декоративный вход.
            transition={{ type: "spring", stiffness: 500, damping: 15 }}
            className={`flex items-center gap-1.5 font-medium ${
              result === "correct"
                ? "text-[var(--color-success-text)]"
                : "text-[var(--color-danger-text)]"
            }`}
          >
            {result === "correct" ? (
              <Check aria-hidden="true" className="h-4 w-4" />
            ) : (
              <X aria-hidden="true" className="h-4 w-4" />
            )}
            {result === "correct" ? "Верно!" : `Правильный ответ: ${answer}`}
          </motion.p>
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
        className={`mb-4 w-full rounded-lg border px-4 py-2.5 text-base outline-none focus:border-[var(--color-forest)] disabled:opacity-60 ${
          result === "correct"
            ? "border-[var(--color-forest)] bg-[var(--color-forest-tint)]"
            : result === "wrong"
              ? "border-[var(--color-danger-text)] bg-[var(--color-danger)]/10"
              : "border-[var(--border-strong)]"
        }`}
      />

      <Button type="submit" variant="leaf" disabled={isPending || (!result && value.trim() === "")}>
        {result ? "Далее" : "Проверить"}
      </Button>
    </form>
  );
}
