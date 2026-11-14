import { pluralRu } from "../plural-ru.ts";
import type { DailyGoalProgress } from "./goal.ts";
import type { DashboardMode } from "./mode.ts";
import type { StreakState } from "./streak.ts";

// Короткие подписи главного экрана, зависящие от состояния. Вынесены из
// компонентов, чтобы их правила (что показываем, когда) проверялись тестами,
// а не только глазами.

/** Строка под приветствием. */
export function greetingSubline(mode: DashboardMode, goal: DailyGoalProgress): string {
  if (mode === "goal-done") return "Цель дня выполнена";
  if (mode === "first-day") return "Первый день — начнём с малого";
  return goal.remaining > 0 ? `Ещё ${goal.remaining} XP до цели дня` : "Цель дня выполнена";
}

/** «Серия продлена…» — только когда серия реально продлена сегодня. */
export function streakExtendedLine(state: StreakState, value: number): string | null {
  if (state !== "extended" || value <= 0) return null;
  return `Серия продлена — ${value} ${pluralRu(value, "день", "дня", "дней")} подряд`;
}

/** Подпись справа в карточке «Неделя»: рекорд или призыв начать серию. */
export function weekNote(input: { streakState: StreakState; streakLongest: number }): string | null {
  if (input.streakState === "broken") return "Серия прервалась — начни новую";
  if (input.streakState === "none" && input.streakLongest <= 0) return "Начни серию сегодня";
  if (input.streakLongest > 0) {
    return `Рекорд: ${input.streakLongest} ${pluralRu(input.streakLongest, "день", "дня", "дней")}`;
  }
  return null;
}
