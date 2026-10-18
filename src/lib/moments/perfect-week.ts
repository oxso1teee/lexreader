// docs/moments/ROADMAP.md, этап 2 — "7 дней из 7 без заморозок". Чистая
// проверка: вызывающий код собирает реальные activity_days за неделю
// (Пн..Вс, ровно 7 элементов, отсутствующий день — не "выполнено").
export interface PerfectWeekDay {
  goalMet: boolean;
  freezeUsed: boolean;
}

export function isPerfectWeek(days: readonly PerfectWeekDay[]): boolean {
  return days.length === 7 && days.every((d) => d.goalMet && !d.freezeUsed);
}
