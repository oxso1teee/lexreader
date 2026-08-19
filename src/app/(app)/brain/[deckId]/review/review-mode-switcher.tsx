"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { SrsParams } from "@/lib/srs";
import ReviewSession, { type ReviewCard } from "./review-session";
import MultipleChoiceMode from "./multiple-choice-mode";
import TypeWordMode from "./type-word-mode";
import MatchPairsMode from "./match-pairs-mode";
import ContextGapMode from "./context-gap-mode";
import WordBuildMode from "./word-build-mode";

const MODES = [
  { value: "cards", label: "Карточки" },
  { value: "choice", label: "Выбор" },
  { value: "type", label: "Напечатать" },
  { value: "build", label: "Собрать" },
  { value: "match", label: "Пары" },
  { value: "context", label: "Контекст" },
] as const;

type Mode = (typeof MODES)[number]["value"];

const MODE_VALUES: readonly string[] = MODES.map((m) => m.value);

function isMode(value: string | null): value is Mode {
  return value !== null && MODE_VALUES.includes(value);
}

export default function ReviewModeSwitcher({
  cards: cardsProp,
  studyDirection,
  srsParams,
  bestSessionCount,
  fsrsEnabled,
  maxIntervalDays,
  sessionTitle,
  targetLanguage,
  userId,
  sessionDeckId,
  missionId,
}: {
  cards: ReviewCard[];
  studyDirection: "front_back" | "back_front";
  srsParams: SrsParams;
  bestSessionCount: number;
  fsrsEnabled: boolean;
  maxIntervalDays: number;
  sessionTitle: string;
  targetLanguage: string;
  userId: string;
  sessionDeckId: string;
  missionId?: string | null;
}) {
  // Снимок один раз здесь — все режимы ниже получают тот же стабильный
  // массив, независимо от неявного refresh страницы после server action.
  const [cards] = useState(cardsProp);
  // Practice Home's quick-practice grid links directly to a mode
  // (/brain/all/review?mode=choice) — read once on mount, same as
  // studyDirection below; switching modes afterwards stays purely in-state.
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<Mode>(() => {
    const requested = searchParams.get("mode");
    return isMode(requested) ? requested : "cards";
  });
  // Идея из разбора конкурента (docs/GROWTH_IDEAS_2026-07-24.md, п.5): быстрый
  // переключатель направления прямо на экране повторения, отдельно от
  // постоянной настройки в Study Settings — действует только на эту сессию.
  const [direction, setDirection] = useState(studyDirection);

  // P0-АУДИТ 3.12 (испр. после повторной проверки): первая версия этого
  // фикса меняла местами front/back один раз здесь, предполагая, что все 4
  // режима одинаково трактуют "front = вопрос, back = ответ". Это неверно:
  // MultipleChoiceMode действительно показывает front как вопрос, а
  // ReviewSession/TypeWordMode ВСЕГДА жёстко показывали back как вопрос
  // (независимо от направления) — баг, существовавший ДО этого фикса. Свап
  // данных превращал несогласованность в противоположную несогласованность
  // вместо исправления. Теперь каждый режим получает studyDirection явно и
  // сам решает, что показывать вопросом, а что ответом.

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
      <p className="px-5 pt-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
        {sessionTitle}
      </p>
      <div className="flex items-center justify-between gap-2 border-b border-black/10 px-5 pt-1 dark:border-white/10">
        <div className="flex gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMode(m.value)}
              className={`-mb-px flex min-h-11 items-center border-b-2 px-2 text-sm font-medium transition-colors ${
                mode === m.value
                  ? "border-black text-black dark:border-white dark:text-white"
                  : "border-transparent text-[var(--text-secondary)] hover:text-black/70 dark:hover:text-white/70"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            setDirection((d) => (d === "front_back" ? "back_front" : "front_back"))
          }
          aria-label="Поменять направление изучения"
          title="Поменять направление изучения (только для этой сессии)"
          className="mb-2 flex min-h-9 shrink-0 items-center gap-1 rounded-full border border-black/10 px-3 text-xs font-medium text-black/60 hover:border-black/30 hover:text-black dark:border-white/15 dark:text-white/60 dark:hover:border-white/40 dark:hover:text-white"
        >
          ⇄ {direction === "front_back" ? "Слово → Перевод" : "Перевод → Слово"}
        </button>
      </div>

      {mode === "cards" && (
        <ReviewSession
          key="cards"
          cards={cards}
          studyDirection={direction}
          srsParams={srsParams}
          bestSessionCount={bestSessionCount}
          fsrsEnabled={fsrsEnabled}
          maxIntervalDays={maxIntervalDays}
          targetLanguage={targetLanguage}
          userId={userId}
          sessionDeckId={sessionDeckId}
          missionId={missionId}
        />
      )}
      {mode === "choice" && (
        <MultipleChoiceMode key="choice" cards={cards} studyDirection={direction} missionId={missionId} />
      )}
      {mode === "type" && (
        <TypeWordMode key="type" cards={cards} studyDirection={direction} missionId={missionId} />
      )}
      {mode === "build" && (
        <WordBuildMode key="build" cards={cards} studyDirection={direction} missionId={missionId} />
      )}
      {mode === "match" && <MatchPairsMode key="match" cards={cards} missionId={missionId} />}
      {mode === "context" && <ContextGapMode key="context" cards={cards} missionId={missionId} />}
    </div>
  );
}
