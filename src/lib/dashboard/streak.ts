import { isoWeekStart } from "../iso-week.ts";

// Серия на главном экране. profiles.streak_current обновляется только при
// активности (touchStreak), поэтому после пропуска в БД ещё лежит старое
// число, хотя серия уже прервана. Эта функция повторяет даты решения из
// streak-engine.ts (сегодня / вчера / позавчера + заморозка этой недели) и
// возвращает то, что честно показать: живую серию или 0 для прерванной.
// Сами данные она не меняет — их по-прежнему пишет только touchStreak().
export type StreakState =
  | "none" // серии нет (0)
  | "extended" // сегодня активность уже была
  | "alive" // вчера была активность — серию нужно продлить сегодня
  | "frozen" // пропущен один день: заморозка сохранит серию, если позаниматься сегодня
  | "broken"; // пропущено больше, чем покрывает заморозка

export interface StreakDisplayInput {
  streakCurrent: number;
  lastActiveDate: string | null;
  freezeAvailable: boolean;
  freezeWeek: string | null;
}

export interface StreakDisplay {
  /** Число для показа: у прерванной серии — 0. */
  value: number;
  state: StreakState;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function streakDisplay(input: StreakDisplayInput, now: Date = new Date()): StreakDisplay {
  const current = Number.isFinite(input.streakCurrent) ? Math.max(0, Math.floor(input.streakCurrent)) : 0;
  if (current === 0) return { value: 0, state: "none" };

  const today = isoDate(now);
  const yesterday = isoDate(new Date(now.getTime() - 86_400_000));
  const twoDaysAgo = isoDate(new Date(now.getTime() - 2 * 86_400_000));
  const last = input.lastActiveDate;

  if (last === today) return { value: current, state: "extended" };
  if (last === yesterday) return { value: current, state: "alive" };
  // Нет даты последней активности при ненулевой серии — обрыв не выдумываем.
  if (last === null) return { value: current, state: "alive" };

  // Та же проверка, что в computeStreakUpdate: заморозка недели свободна, если
  // она ещё не тратилась на этой ISO-неделе.
  const freezeNow = input.freezeWeek !== isoDate(isoWeekStart(now)) ? true : input.freezeAvailable;
  if (last === twoDaysAgo && freezeNow) return { value: current, state: "frozen" };

  return { value: 0, state: "broken" };
}
