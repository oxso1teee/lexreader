import type { PublicStep } from "./plan.ts";
import type { ExerciseResponse } from "./types.ts";

// Чистая модель плеера: что показывает главная кнопка, куда вести после
// действия, как восстановиться. Компонент (components/product/lessons) только
// отрисовывает результат и вызывает серверные действия — всё решение «что
// сейчас можно» живёт здесь и проверяется unit-тестами.
//
// Два указателя:
//   stepIndex — сколько шагов уже ПРИНЯТО сервером (хранится в БД);
//   view      — какой шаг сейчас на экране (0..steps.length). view может быть
//               меньше stepIndex (пользователь вернулся посмотреть пройденное)
//               и никогда не больше него: вперёд можно только через сервер.

export type PrimaryKind =
  /** Шаг с содержимым: сообщить серверу «прочитано». */
  | "advance"
  /** Упражнение: отправить ответ на проверку. */
  | "submit"
  /** Просмотр пройденного: просто перейти дальше, без сервера. */
  | "next"
  /** Все шаги пройдены: завершить урок. */
  | "finish";

export interface PrimaryAction {
  kind: PrimaryKind;
  label: string;
  disabled: boolean;
  /** Подсказка, почему кнопка недоступна. */
  hint?: string;
}

export interface PlayerPosition {
  steps: readonly PublicStep[];
  stepIndex: number;
  view: number;
  /** id упражнений, на которые уже есть принятый ответ. */
  answeredIds: ReadonlySet<string>;
  draft: ExerciseResponse | null;
}

export function hasDraft(draft: ExerciseResponse | null): boolean {
  if (!draft) return false;
  return draft.type === "choice" ? Number.isInteger(draft.index) && draft.index >= 0 : draft.tiles.length > 0;
}

export function isFinishView(steps: readonly PublicStep[], view: number): boolean {
  return view >= steps.length;
}

function isLast(steps: readonly PublicStep[], view: number): boolean {
  return view === steps.length - 1;
}

const FINISH_LABEL = "Завершить урок";

export function describePrimary(position: PlayerPosition): PrimaryAction {
  const { steps, stepIndex, view, answeredIds, draft } = position;
  if (isFinishView(steps, view)) return { kind: "finish", label: FINISH_LABEL, disabled: false };

  const step = steps[view];
  if (step.kind === "content") {
    if (view < stepIndex) {
      return isLast(steps, view) ? { kind: "finish", label: FINISH_LABEL, disabled: false } : { kind: "next", label: "Далее", disabled: false };
    }
    if (isLast(steps, view)) return { kind: "advance", label: FINISH_LABEL, disabled: false };
    const following = steps[view + 1];
    const label = step.block === "intro" ? "Начать" : following.kind === "exercise" ? "К упражнениям" : "Далее";
    return { kind: "advance", label, disabled: false };
  }

  const exerciseId = step.exercise?.id ?? "";
  if (answeredIds.has(exerciseId)) {
    return isLast(steps, view) ? { kind: "finish", label: FINISH_LABEL, disabled: false } : { kind: "next", label: "Далее", disabled: false };
  }
  const ready = hasDraft(draft);
  return {
    kind: "submit",
    label: "Проверить",
    disabled: !ready,
    hint: ready ? undefined : step.exercise?.type === "sentence_build" ? "Собери предложение, чтобы проверить." : "Выбери ответ, чтобы проверить.",
  };
}

/** С какого шага продолжать: с первого непринятого; всё принято — на панель завершения. */
export function resumeView(stepIndex: number, stepsTotal: number): number {
  return Math.max(0, Math.min(stepIndex, stepsTotal));
}

/** Шкала прогресса — по ПРИНЯТЫМ сервером шагам, а не по тому, что на экране. */
export function progressRatio(stepIndex: number, stepsTotal: number): number {
  return stepsTotal > 0 ? Math.min(1, Math.max(0, stepIndex / stepsTotal)) : 0;
}

/** «Шаг 3 из 8»; на панели завершения номер не выходит за total. */
export function stepCounter(view: number, stepsTotal: number): string {
  return `Шаг ${Math.min(view + 1, stepsTotal)} из ${stepsTotal}`;
}

export function canGoBack(view: number): boolean {
  return view > 0;
}

/** Куда идти после действия: назад не дальше 0, вперёд не дальше уже принятого. */
export function clampView(view: number, stepIndex: number, stepsTotal: number): number {
  return Math.max(0, Math.min(view, stepIndex, stepsTotal));
}

/** Номер упражнения среди упражнений («Задание 2 из 5») или null для шага с содержимым. */
export function exercisePosition(steps: readonly PublicStep[], view: number): { number: number; total: number } | null {
  if (steps[view]?.kind !== "exercise") return null;
  const total = steps.filter((step) => step.kind === "exercise").length;
  const number = steps.slice(0, view + 1).filter((step) => step.kind === "exercise").length;
  return { number, total };
}
