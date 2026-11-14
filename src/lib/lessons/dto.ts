import type { Moment } from "../moments/types.ts";
import type { AnsweredResult } from "./attempt-state.ts";
import type { PublicStep } from "./plan.ts";
import type { AttemptBucket } from "./scoring.ts";
import type { PathSlug } from "../learning-paths/types.ts";
import type { LessonMode } from "./types.ts";

// Что уходит клиенту. Правильные ответы здесь есть только в `answered` — то
// есть по упражнениям, на которые пользователь уже ответил.

export interface StepProgressDto {
  stepIndex: number;
  stepsTotal: number;
  correctCount: number;
  incorrectCount: number;
}

export interface LessonSessionDto extends StepProgressDto {
  attemptId: string;
  mode: LessonMode;
  /** Попытка продолжена с сохранённого места, а не начата с нуля. */
  resumed: boolean;
  steps: PublicStep[];
  answered: Record<string, AnsweredResult>;
}

export interface SubmitAnswerDto {
  result: AnsweredResult;
  progress: StepProgressDto;
  /** Ответ на это упражнение уже был принят раньше — ничего не изменилось. */
  replayed: boolean;
}

export interface NextLessonDto {
  skillKey: string;
  unitKey: string;
  title: string;
}

export interface LessonCompletionDto {
  attemptId: string;
  pathSlug: PathSlug;
  skillKey: string;
  mode: LessonMode;
  /** Этот вызов применил итоги попытки (прогресс, XP). false — повторное открытие
   *  экрана результата: данные те же, побочных эффектов и моментов нет. */
  finalizedNow: boolean;
  passed: boolean;
  /** null — в уроке не было упражнений. */
  scoreRatio: number | null;
  bucket: AttemptBucket | null;
  correctCount: number;
  incorrectCount: number;
  /** XP, начисленный за эту попытку (0 — если XP за навык уже получен или попытка не зачтена). */
  xpAwarded: number;
  /** XP за этот навык уже был получен раньше. */
  xpAlreadyEarned: boolean;
  /** Урок засчитан, но начислить XP не удалось: право на награду сохранено, повторный
   *  вызов завершения начислит её (кнопка «Повторить начисление»). */
  xpPending: boolean;
  /** Урок засчитан (в том числе раньше). */
  lessonCompleted: boolean;
  firstWin: boolean;
  /** Моменты показываются только при первом завершении, повторное открытие экрана их не повторяет. */
  moments: Moment[];
  path: {
    percent: number;
    doneLessons: number;
    totalLessons: number;
    complete: boolean;
    unitTitle: string;
    unitDone: boolean;
  };
  nextLesson: NextLessonDto | null;
}
