// docs/moments/ROADMAP.md, этап 1 — "Цель дня в XP: 20/50/80/120 =
// 5/10/15/20 минут". Фиксированные пресеты (не линейная формула — шаг в
// минутах специально неравномерный), источник правды для подписи
// "~N минут" на Goal-done (минута показывается как дружелюбный ориентир,
// сама цель хранится и сравнивается только в XP).
export const DAILY_XP_GOAL_PRESETS: readonly { xp: number; minutes: number }[] = [
  { xp: 20, minutes: 5 },
  { xp: 50, minutes: 10 },
  { xp: 80, minutes: 15 },
  { xp: 120, minutes: 20 },
];

export const DEFAULT_DAILY_XP_GOAL = 50;

/** Для цели вне 4 пресетов (не должно встречаться после этапа 7 — там
 *  выбор только из них) — ближайшая по XP оценка, не угадывание с нуля. */
export function minutesHintForGoal(goalXp: number): number {
  const exact = DAILY_XP_GOAL_PRESETS.find((p) => p.xp === goalXp);
  if (exact) return exact.minutes;
  const closest = [...DAILY_XP_GOAL_PRESETS].sort((a, b) => Math.abs(a.xp - goalXp) - Math.abs(b.xp - goalXp))[0];
  return Math.max(1, Math.round((closest.minutes * goalXp) / closest.xp));
}
