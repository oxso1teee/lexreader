"use client";

import { useState, useTransition } from "react";
import { reviewWord } from "./actions";
import SessionComplete from "./session-complete";

export interface ReviewCard {
  flashcardId: string;
  front: string;
  back: string;
  notes: string | null;
}

const GRADES: { value: 0 | 1 | 2 | 3; label: string; className: string }[] = [
  { value: 0, label: "Не помню", className: "bg-red-600 hover:bg-red-500" },
  { value: 1, label: "Трудно", className: "bg-orange-500 hover:bg-orange-400" },
  { value: 2, label: "Помню", className: "bg-emerald-600 hover:bg-emerald-500" },
  { value: 3, label: "Легко", className: "bg-emerald-700 hover:bg-emerald-600" },
];

export default function ReviewSession({
  cards: cardsProp,
  studyDirection,
}: {
  cards: ReviewCard[];
  studyDirection: "front_back" | "back_front";
}) {
  // Снимок очереди на момент старта сессии: серверные экшены ревью вызывают
  // неявный refresh страницы, из-за которого /review перезапросил бы уже
  // пустую очередь и подменил дерево прямо посреди сессии, если бы мы читали
  // проп напрямую.
  const [cards] = useState(cardsProp);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [isPending, startTransition] = useTransition();

  const done = index >= cards.length;
  const card = cards[index];
  // P0-АУДИТ 3.12 (испр.): раньше здесь было жёстко "вопрос = back, ответ =
  // front" независимо от направления — с настройкой по умолчанию
  // ("Слово → Перевод") это показывало перевод и спрашивало слово, то есть
  // ровно наоборот тому, что написано в настройках.
  const question = studyDirection === "back_front" ? card?.back : card?.front;
  const answer = studyDirection === "back_front" ? card?.front : card?.back;

  function grade(value: 0 | 1 | 2 | 3) {
    startTransition(async () => {
      await reviewWord(card.flashcardId, value);
      setRevealed(false);
      setIndex((i) => i + 1);
    });
  }

  if (done) {
    return <SessionComplete count={cards.length} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-5 py-8">
      <p className="mb-4 text-sm text-black/50 dark:text-white/50">
        {index + 1} / {cards.length}
      </p>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <p className="text-2xl font-semibold">{question}</p>

        {revealed && (
          <div className="flex flex-col gap-1">
            <p className="text-xl font-medium text-black/80 dark:text-white/80">
              {answer}
            </p>
            {card.notes && (
              <p className="max-w-sm text-sm text-black/50 dark:text-white/50">{card.notes}</p>
            )}
          </div>
        )}
      </div>

      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="rounded-full bg-black px-5 py-3 font-medium text-white dark:bg-white dark:text-black"
        >
          Показать ответ
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {GRADES.map((g) => (
            <button
              key={g.value}
              type="button"
              disabled={isPending}
              onClick={() => grade(g.value)}
              className={`rounded-full px-4 py-3 font-medium text-white transition-colors disabled:opacity-50 ${g.className}`}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
