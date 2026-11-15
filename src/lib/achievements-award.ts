import {
  ACHIEVEMENT_DEFS,
  neededStats,
  newlyEarned,
  type AchievementDef,
  type AchievementStats,
  type StatKey,
} from "./achievements-catalog.ts";

// Выдача достижений. Порты вынесены, чтобы условия, повторы и параллельные
// вызовы проверялись без БД; настоящие порты — achievements-actions.ts.

export interface AchievementPorts {
  /** id уже полученных достижений. */
  loadEarnedIds(): Promise<Set<string>>;
  /** Значения только запрошенных показателей (лишние запросы к БД не делаем). */
  loadStats(keys: readonly StatKey[]): Promise<Partial<AchievementStats>>;
  /** Запись получения. Возвращает id, которые действительно ВПЕРВЫЕ записаны этим вызовом
   *  (повтор уникального ключа — не ошибка и не возвращается). */
  insertEarned(ids: readonly string[]): Promise<string[]>;
}

/** Проверяет ещё не полученные достижения и выдаёт новые. Возвращает id именно новых. */
export async function awardAchievements(ports: AchievementPorts, defs: readonly AchievementDef[] = ACHIEVEMENT_DEFS): Promise<string[]> {
  const earned = await ports.loadEarnedIds();
  const locked = defs.filter((d) => !earned.has(d.id));
  if (locked.length === 0) return [];

  const stats = await ports.loadStats(neededStats(locked));
  const reached = newlyEarned(stats, earned, defs);
  if (reached.length === 0) return [];

  return ports.insertEarned(reached.map((d) => d.id));
}
