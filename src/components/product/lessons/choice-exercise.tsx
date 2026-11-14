"use client";

import type { Ref } from "react";
import { ChoiceGroup, type ChoiceOption } from "@/components/ui/choice-group";
import type { AnsweredResult } from "@/lib/lessons/attempt-state";
import type { ExerciseResponse, PublicChoiceExercise } from "@/lib/lessons/types";
import StepHeading from "./step-heading";

const BLANK = "___";

// Предложение с пропуском: выбранный вариант встаёт на место, до выбора — линия.
function BlankPrompt({ prompt, filled, state }: { prompt: string; filled: string | null; state?: "correct" | "incorrect" }) {
  const at = prompt.indexOf(BLANK);
  if (at < 0) return <>{prompt}</>;
  return (
    <>
      {prompt.slice(0, at)}
      <span className="ls-blank" data-state={state}>
        {filled ?? <span className="sr-only">пропуск</span>}
      </span>
      {prompt.slice(at + BLANK.length)}
    </>
  );
}

// multiple_choice и fill_blank: один вид «выбери вариант». Разница только в
// заголовке (у fill_blank пропуск подставляется в предложение). Правильный
// вариант клиенту неизвестен до ответа — после него его даёт сервер
// (verdict.correctAnswer), по нему подсвечивается карточка.
export default function ChoiceExercise({
  exercise,
  draft,
  onDraftChange,
  result,
  disabled,
  headingRef,
  eyebrow,
}: {
  exercise: PublicChoiceExercise;
  draft: ExerciseResponse | null;
  onDraftChange: (draft: ExerciseResponse | null) => void;
  result: AnsweredResult | null;
  disabled: boolean;
  headingRef?: Ref<HTMLHeadingElement>;
  eyebrow?: string;
}) {
  const answered = result !== null;
  const chosen = answered
    ? result.response.type === "choice"
      ? result.response.index
      : null
    : draft?.type === "choice"
      ? draft.index
      : null;
  const correctText = result?.verdict.correctAnswer ?? null;

  function stateFor(index: number): ChoiceOption["state"] {
    if (!result) return undefined;
    if (index === chosen) return result.verdict.correct ? "correct" : "incorrect";
    return !result.verdict.correct && exercise.options[index] === correctText ? "correct" : undefined;
  }

  const options: ChoiceOption[] = exercise.options.map((label, index) => ({
    value: String(index),
    label,
    disabled: disabled || answered,
    state: stateFor(index),
  }));

  const blankState = result ? (result.verdict.correct ? "correct" : "incorrect") : undefined;
  const filled = chosen !== null ? (exercise.options[chosen] ?? null) : null;

  return (
    <>
      <StepHeading eyebrow={eyebrow} headingRef={headingRef}>
        {exercise.type === "fill_blank" ? <BlankPrompt prompt={exercise.prompt} filled={filled} state={blankState} /> : exercise.prompt}
      </StepHeading>
      <ChoiceGroup
        key={exercise.id}
        legend={exercise.prompt.replace(BLANK, "пропуск")}
        name={`exercise-${exercise.id}`}
        numbered
        options={options}
        value={chosen === null ? "" : String(chosen)}
        onValueChange={(value) => onDraftChange({ type: "choice", index: Number(value) })}
      />
    </>
  );
}
