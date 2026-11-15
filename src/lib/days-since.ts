// docs/moments/ROADMAP.md, этап 7 — Welcome-back. last_active_date —
// простая дата (YYYY-MM-DD, profiles.last_active_date, пишется touchStreak())
// — этого достаточно, без новой колонки. Вынесено в отдельный хелпер:
// раньше тот же расчёт был только инлайн в push-reminders/route.ts.
export function daysSinceLastActive(lastActiveDate: string | null, now: Date = new Date()): number {
  if (!lastActiveDate) return 0;
  const last = new Date(`${lastActiveDate}T00:00:00Z`);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.round((today.getTime() - last.getTime()) / 86_400_000);
}
