import { daysSinceLastActive } from "../days-since.ts";
import { pluralRu } from "../plural-ru.ts";

// Итоги дня для состояния «цель выполнена». Берём только то, что реально
// записывается: activity_days.minutes и .lessons не заполняются нигде (см.
// комментарий в daily-quests.ts), поэтому «3 занятия · 21 мин» из макета
// честно показать нельзя. Вместо них — минуты по завершённым сессиям чтения,
// число повторений карточек (review_log) и новых слов (vocabulary_items).
export interface SessionLike {
  started_at: string;
  ended_at: string | null;
}

/** Минуты чтения: сумма (ended_at − started_at) по завершённым сессиям, начатым не раньше sinceMs. */
export function readingMinutesSince(sessions: readonly SessionLike[], sinceMs: number): number {
  return sessions.reduce((sum, s) => {
    if (!s.ended_at) return sum;
    const started = new Date(s.started_at).getTime();
    const ended = new Date(s.ended_at).getTime();
    if (!Number.isFinite(started) || !Number.isFinite(ended) || started < sinceMs) return sum;
    return sum + Math.max(0, Math.round((ended - started) / 60_000));
  }, 0);
}

/** Сколько отметок времени не раньше sinceMs. */
export function countSince(timestamps: readonly string[], sinceMs: number): number {
  return timestamps.filter((t) => {
    const ms = new Date(t).getTime();
    return Number.isFinite(ms) && ms >= sinceMs;
  }).length;
}

export interface TodaySummary {
  readingMinutes: number;
  newWords: number;
  reviews: number;
}

/** Короткие фразы для строки итогов; нулевые показатели не выводим. */
export function summarizeToday(s: TodaySummary): string[] {
  const parts: string[] = [];
  if (s.readingMinutes > 0) parts.push(`${s.readingMinutes} мин чтения`);
  if (s.reviews > 0) parts.push(`${s.reviews} ${pluralRu(s.reviews, "повторение", "повторения", "повторений")}`);
  if (s.newWords > 0) parts.push(`${s.newWords} ${pluralRu(s.newWords, "новое слово", "новых слова", "новых слов")}`);
  return parts;
}

/** «сегодня» / «вчера» / «5 дней назад» по profiles.last_active_date; null — активности ещё не было. */
export function lastActivityLabel(lastActiveDate: string | null, now: Date = new Date()): string | null {
  if (!lastActiveDate) return null;
  const days = daysSinceLastActive(lastActiveDate, now);
  if (days < 0) return null;
  if (days === 0) return "сегодня";
  if (days === 1) return "вчера";
  return `${days} ${pluralRu(days, "день", "дня", "дней")} назад`;
}
