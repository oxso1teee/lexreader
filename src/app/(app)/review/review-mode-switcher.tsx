"use client";

import { useState } from "react";
import ReviewSession, { type ReviewCard } from "./review-session";
import MultipleChoiceMode from "./multiple-choice-mode";
import TypeWordMode from "./type-word-mode";
import MatchPairsMode from "./match-pairs-mode";

const MODES = [
  { value: "cards", label: "Карточки" },
  { value: "choice", label: "Выбор" },
  { value: "type", label: "Напечатать" },
  { value: "match", label: "Пары" },
] as const;

type Mode = (typeof MODES)[number]["value"];

export default function ReviewModeSwitcher({ cards: cardsProp }: { cards: ReviewCard[] }) {
  // Снимок один раз здесь — все режимы ниже получают тот же стабильный
  // массив, независимо от неявного refresh страницы после server action.
  const [cards] = useState(cardsProp);
  const [mode, setMode] = useState<Mode>("cards");

  if (cards.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 text-center">
        <p className="text-xl font-semibold">Нечего повторять</p>
        <p className="text-black/60 dark:text-white/60">
          Все слова повторены на сегодня. Возвращайся завтра или почитай что-нибудь новое.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex justify-center gap-2 border-b border-black/10 px-5 pt-3 dark:border-white/10">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            className={`-mb-px border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
              mode === m.value
                ? "border-black text-black dark:border-white dark:text-white"
                : "border-transparent text-black/40 hover:text-black/70 dark:text-white/40 dark:hover:text-white/70"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "cards" && <ReviewSession key="cards" cards={cards} />}
      {mode === "choice" && <MultipleChoiceMode key="choice" cards={cards} />}
      {mode === "type" && <TypeWordMode key="type" cards={cards} />}
      {mode === "match" && <MatchPairsMode key="match" cards={cards} />}
    </div>
  );
}
