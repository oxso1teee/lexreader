// Какой вариант главного экрана показать (макеты Today-new / Today / Today-done).
// Это состояния одного маршрута /home, а не отдельные страницы: решение
// принимается по реальным данным профиля и активности.
export type DashboardMode = "first-day" | "regular" | "goal-done";

export interface DashboardModeInput {
  /** XP за сегодня достиг profiles.daily_xp_goal. */
  goalDone: boolean;
  /** Накопленный XP профиля (profiles.xp). */
  xp: number;
  /** Чек-лист первых шагов сейчас показывается (молодой аккаунт, шаги не закончены). */
  firstStepsVisible: boolean;
  firstStepsDone: number;
}

export function dashboardMode(input: DashboardModeInput): DashboardMode {
  // Цель выполнена — это главный факт дня, он важнее «новичка».
  if (input.goalDone) return "goal-done";
  // «Первый день» — ничего ещё не сделано: ни шагов чек-листа, ни единого XP.
  if (input.firstStepsVisible && input.firstStepsDone === 0 && input.xp <= 0) return "first-day";
  return "regular";
}

/** Полных суток с создания профиля; для неизвестной даты — «очень давно», чтобы не показывать чек-лист новичка. */
export function accountAgeDays(createdAt: string | null | undefined, now: Date = new Date()): number {
  if (!createdAt) return Number.MAX_SAFE_INTEGER;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return Number.MAX_SAFE_INTEGER;
  return Math.floor((now.getTime() - created) / 86_400_000);
}
