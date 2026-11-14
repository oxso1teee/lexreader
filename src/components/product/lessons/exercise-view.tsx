"use client";

import type { Ref } from "react";
import type { AnsweredResult } from "@/lib/lessons/attempt-state";
import type { ExerciseResponse, PublicExercise } from "@/lib/lessons/types";
import ChoiceExercise from "./choice-exercise";
import SentenceBuildExercise from "./sentence-build-exercise";

export interface ExerciseViewProps {
  exercise: PublicExercise;
  draft: ExerciseResponse | null;
  onDraftChange: (draft: ExerciseResponse | null) => void;
  /** Принятый ответ с проверкой — упражнение показывается в режиме просмотра. */
  result: AnsweredResult | null;
  /** Идёт отправка: ввод заблокирован. */
  disabled: boolean;
  headingRef?: Ref<HTMLHeadingElement>;
  eyebrow?: string;
}

// Один вход для всех типов упражнений: «данные + тип → отрисовка». Новый тип
// (перевод, сопоставление…) — новая ветка здесь и новый компонент; плеер,
// проверка и сохранение не меняются. switch исчерпывающий: забытый тип — ошибка
// компиляции.
export default function ExerciseView(props: ExerciseViewProps) {
  const { exercise } = props;
  switch (exercise.type) {
    case "multiple_choice":
    case "fill_blank":
      return <ChoiceExercise key={exercise.id} {...props} exercise={exercise} />;
    case "sentence_build":
      return <SentenceBuildExercise key={exercise.id} {...props} exercise={exercise} />;
  }
}
