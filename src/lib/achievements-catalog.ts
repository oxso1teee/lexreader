// Каталог достижений — фиксированный список в коде (не таблица): docs/
// IMPLEMENTATION_PROMPT_2026-07-28.md, раздел 5.2. Факт получения хранится в
// user_achievements (уникально по (owner_id, achievement_id) — повторно не
// выдаётся). Iteration 6 расширила каталог категориями и условиями на реальных
// данных; прежние id (streak_7, words_100, first_book, perfect_session) сохранены.
//
// Чистый модуль без иконок и без сети — условия и прогресс проверяются
// обычными unit-тестами. Иконки подключает achievements.ts.

export type AchievementCategory = "learning" | "reading" | "vocabulary" | "consistency" | "milestones";

export const ACHIEVEMENT_CATEGORIES: ReadonlyArray<{ id: AchievementCategory; title: string }> = [
  { id: "learning", title: "Обучение" },
  { id: "reading", title: "Чтение" },
  { id: "vocabulary", title: "Словарь" },
  { id: "consistency", title: "Постоянство" },
  { id: "milestones", title: "Вехи" },
];

/** Числа, по которым проверяются условия. Каждое считается из фактов в БД. */
export interface AchievementStats {
  /** Сохранённые слова на изучаемом языке. */
  totalWords: number;
  /** Дочитанные до конца тексты на изучаемом языке. */
  finishedTexts: number;
  /** Лучшая серия: максимум из текущей и рекордной (рекорд не пропадает вместе с серией). */
  bestStreak: number;
  /** Личный рекорд карточек в одной сессии повторения. */
  bestSessionCount: number;
  /** Зачтённые уроки учебных путей. */
  lessons: number;
  /** Все оценки карточек за всё время. */
  reviewsTotal: number;
  /** Дни, когда выполнена цель дня в XP. */
  goalDays: number;
  /** Идеальные недели (цель дня все 7 дней). */
  perfectWeeks: number;
  /** Открытые сундуки заданий дня. */
  chests: number;
  /** Весь XP. */
  totalXp: number;
}

export type StatKey = keyof AchievementStats;

export const STAT_KEYS: readonly StatKey[] = [
  "totalWords",
  "finishedTexts",
  "bestStreak",
  "bestSessionCount",
  "lessons",
  "reviewsTotal",
  "goalDays",
  "perfectWeeks",
  "chests",
  "totalXp",
];

export interface AchievementDef {
  id: string;
  category: AchievementCategory;
  title: string;
  description: string;
  /** Условие: stats[stat] >= target. */
  stat: StatKey;
  target: number;
}

export const ACHIEVEMENT_DEFS: readonly AchievementDef[] = [
  // Обучение
  { id: "first_lesson", category: "learning", title: "Первый урок", description: "Пройден первый урок учебного пути", stat: "lessons", target: 1 },
  { id: "lessons_5", category: "learning", title: "Пять уроков", description: "5 пройденных уроков", stat: "lessons", target: 5 },
  { id: "lessons_25", category: "learning", title: "Двадцать пять уроков", description: "25 пройденных уроков", stat: "lessons", target: 25 },
  // Чтение
  { id: "first_book", category: "reading", title: "Первая книга", description: "Дочитан первый текст до конца", stat: "finishedTexts", target: 1 },
  { id: "books_5", category: "reading", title: "Пять текстов", description: "5 дочитанных текстов", stat: "finishedTexts", target: 5 },
  { id: "books_20", category: "reading", title: "Двадцать текстов", description: "20 дочитанных текстов", stat: "finishedTexts", target: 20 },
  // Словарь
  { id: "words_10", category: "vocabulary", title: "Первые слова", description: "10 сохранённых слов", stat: "totalWords", target: 10 },
  { id: "words_100", category: "vocabulary", title: "Сто слов", description: "100 сохранённых слов", stat: "totalWords", target: 100 },
  { id: "words_500", category: "vocabulary", title: "Пятьсот слов", description: "500 сохранённых слов", stat: "totalWords", target: 500 },
  { id: "reviews_100", category: "vocabulary", title: "Сто повторений", description: "100 оценённых карточек", stat: "reviewsTotal", target: 100 },
  { id: "perfect_session", category: "vocabulary", title: "Идеальная сессия", description: "Личный рекорд повторения — 20+ карточек за раз", stat: "bestSessionCount", target: 20 },
  // Постоянство
  { id: "streak_3", category: "consistency", title: "Три дня подряд", description: "3 дня подряд в приложении", stat: "bestStreak", target: 3 },
  { id: "streak_7", category: "consistency", title: "Неделя подряд", description: "7 дней подряд в приложении", stat: "bestStreak", target: 7 },
  { id: "streak_30", category: "consistency", title: "Месяц подряд", description: "30 дней подряд в приложении", stat: "bestStreak", target: 30 },
  { id: "streak_100", category: "consistency", title: "Сто дней подряд", description: "100 дней подряд в приложении", stat: "bestStreak", target: 100 },
  { id: "goal_days_7", category: "consistency", title: "Семь целей", description: "Цель дня выполнена 7 раз", stat: "goalDays", target: 7 },
  { id: "goal_days_30", category: "consistency", title: "Тридцать целей", description: "Цель дня выполнена 30 раз", stat: "goalDays", target: 30 },
  { id: "perfect_week", category: "consistency", title: "Идеальная неделя", description: "Цель дня выполнена все 7 дней недели", stat: "perfectWeeks", target: 1 },
  // Вехи
  { id: "xp_100", category: "milestones", title: "Первые 100 XP", description: "Набрано 100 XP", stat: "totalXp", target: 100 },
  { id: "xp_500", category: "milestones", title: "500 XP", description: "Набрано 500 XP", stat: "totalXp", target: 500 },
  { id: "xp_1000", category: "milestones", title: "1000 XP", description: "Набрано 1000 XP", stat: "totalXp", target: 1000 },
  { id: "xp_5000", category: "milestones", title: "5000 XP", description: "Набрано 5000 XP", stat: "totalXp", target: 5000 },
  { id: "first_chest", category: "milestones", title: "Первый сундук", description: "Выполнены все задания дня и открыт сундук", stat: "chests", target: 1 },
];

export function isAchievementEarned(def: Pick<AchievementDef, "stat" | "target">, stats: Partial<AchievementStats>): boolean {
  return (stats[def.stat] ?? 0) >= def.target;
}

export interface AchievementProgress {
  current: number;
  target: number;
  /** 0..1 */
  ratio: number;
}

/** Прогресс к условию; current не превышает target. */
export function achievementProgress(def: Pick<AchievementDef, "stat" | "target">, stats: Partial<AchievementStats>): AchievementProgress {
  const raw = stats[def.stat] ?? 0;
  const current = Math.max(0, Math.min(def.target, Number.isFinite(raw) ? Math.floor(raw) : 0));
  return { current, target: def.target, ratio: def.target > 0 ? current / def.target : 0 };
}

export type AchievementStatus = "earned" | "in_progress" | "locked";

export interface AchievementView extends AchievementDef {
  status: AchievementStatus;
  progress: AchievementProgress;
  /** Дата получения (ISO) — только у полученных. */
  earnedAt: string | null;
}

/** Статус для витрины: получено (по факту в БД — условие не пересчитывается заново), в процессе или закрыто. */
export function buildAchievementViews(
  stats: Partial<AchievementStats>,
  earned: ReadonlyMap<string, string | null>,
  defs: readonly AchievementDef[] = ACHIEVEMENT_DEFS,
): AchievementView[] {
  return defs.map((def) => {
    const progress = achievementProgress(def, stats);
    const earnedAt = earned.get(def.id);
    const isEarned = earned.has(def.id);
    return {
      ...def,
      progress: isEarned ? { current: def.target, target: def.target, ratio: 1 } : progress,
      status: isEarned ? "earned" : progress.current > 0 ? "in_progress" : "locked",
      earnedAt: isEarned ? (earnedAt ?? null) : null,
    };
  });
}

/** Какие статистики нужны, чтобы проверить ещё не полученные достижения (лишнее не считаем). */
export function neededStats(locked: readonly AchievementDef[]): StatKey[] {
  return [...new Set(locked.map((d) => d.stat))];
}

/** Достижения, чьё условие выполнено среди ещё не полученных. */
export function newlyEarned(stats: Partial<AchievementStats>, earnedIds: ReadonlySet<string>, defs: readonly AchievementDef[] = ACHIEVEMENT_DEFS): AchievementDef[] {
  return defs.filter((d) => !earnedIds.has(d.id) && isAchievementEarned(d, stats));
}
