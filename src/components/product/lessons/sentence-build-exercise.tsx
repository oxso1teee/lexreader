"use client";

import { RotateCcw } from "lucide-react";
import { useState, type Ref } from "react";
import { Button } from "@/components/ui/button";
import type { AnsweredResult } from "@/lib/lessons/attempt-state";
import type { ExerciseResponse, PublicSentenceBuildExercise } from "@/lib/lessons/types";
import StepHeading from "./step-heading";

// «Собери предложение»: слова-тайлы переносятся из банка в строку ответа и
// обратно. Всё управляется кнопками (Tab/Enter/Space), без перетаскивания —
// так работает и на телефоне, и с клавиатуры, и со скринридером. Порядок
// слов в верном решении клиенту неизвестен: тайлы приходят перемешанными.
export default function SentenceBuildExercise({
  exercise,
  onDraftChange,
  result,
  disabled,
  headingRef,
  eyebrow,
}: {
  exercise: PublicSentenceBuildExercise;
  onDraftChange: (draft: ExerciseResponse | null) => void;
  result: AnsweredResult | null;
  disabled: boolean;
  headingRef?: Ref<HTMLHeadingElement>;
  eyebrow?: string;
}) {
  // Индексы тайлов в порядке выбора. Состояние локально: компонент
  // пересоздаётся на каждом упражнении (key в exercise-view).
  const [picked, setPicked] = useState<number[]>([]);
  const answered = result !== null;
  const locked = disabled || answered;

  function update(next: number[]) {
    setPicked(next);
    onDraftChange(next.length > 0 ? { type: "tiles", tiles: next.map((index) => exercise.tiles[index]) } : null);
  }

  const lineTiles = answered
    ? result.response.type === "tiles"
      ? result.response.tiles
      : []
    : picked.map((index) => exercise.tiles[index]);
  const lineState = result ? (result.verdict.correct ? "correct" : "incorrect") : undefined;

  return (
    <>
      <StepHeading eyebrow={eyebrow} headingRef={headingRef}>
        {exercise.instruction}
      </StepHeading>
      {!answered && <p className="ls-lead">Это один из примеров урока. Нажимай на слова по порядку.</p>}

      <div className="sb-line" role="group" aria-label="Твой ответ" data-state={lineState}>
        {lineTiles.length === 0 && <span className="sb-placeholder">Нажимай на слова ниже, чтобы собрать предложение</span>}
        {answered
          ? lineTiles.map((tile, position) => (
              <span key={position} className="sb-tile" data-static="true">
                {tile}
              </span>
            ))
          : picked.map((tileIndex, position) => (
              <button
                key={`${tileIndex}-${position}`}
                type="button"
                className="sb-tile"
                disabled={locked}
                aria-label={`${exercise.tiles[tileIndex]} — убрать из ответа`}
                onClick={() => update(picked.filter((_, index) => index !== position))}
              >
                {exercise.tiles[tileIndex]}
              </button>
            ))}
      </div>

      {!answered && (
        <>
          <ul className="sb-bank" aria-label="Слова для предложения">
            {exercise.tiles.map((tile, index) => {
              const used = picked.includes(index);
              return (
                <li key={index}>
                  <button
                    type="button"
                    className="sb-tile"
                    data-used={used}
                    disabled={locked || used}
                    tabIndex={used ? -1 : undefined}
                    aria-hidden={used || undefined}
                    onClick={() => update([...picked, index])}
                  >
                    {tile}
                  </button>
                </li>
              );
            })}
          </ul>
          {picked.length > 0 && (
            <Button variant="ghost" size="sm" className="sb-clear" disabled={locked} onClick={() => update([])}>
              <RotateCcw aria-hidden="true" className="h-4 w-4" /> Сбросить
            </Button>
          )}
          <p role="status" aria-live="polite" className="sr-only">
            {picked.length > 0 ? `В ответе слов: ${picked.length} из ${exercise.tiles.length}` : ""}
          </p>
        </>
      )}
    </>
  );
}
