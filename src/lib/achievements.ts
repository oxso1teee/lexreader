import {
  Award,
  BookOpen,
  CalendarCheck,
  Flame,
  Gift,
  GraduationCap,
  Library,
  Repeat,
  Star,
  Target,
  Trophy,
  Type,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { ACHIEVEMENT_DEFS, isAchievementEarned, type AchievementDef, type AchievementStats } from "./achievements-catalog.ts";

export {
  ACHIEVEMENT_CATEGORIES,
  buildAchievementViews,
  type AchievementCategory,
  type AchievementStats,
  type AchievementView,
} from "./achievements-catalog.ts";

// docs/IMPLEMENTATION_PROMPT_2026-07-28.md, раздел 5.2: каталог достижений —
// фиксированный список в коде (не таблица). Условия и категории — в
// achievements-catalog.ts (чистый модуль, покрыт тестами); здесь к ним
// добавляются иконки (redesign/duolingo-flat phase 2: единая иконочная система,
// lucide-react).

export interface Achievement extends AchievementDef {
  icon: LucideIcon;
  check: (s: Partial<AchievementStats>) => boolean;
}

const ICONS: Readonly<Record<string, LucideIcon>> = {
  first_lesson: GraduationCap,
  lessons_5: GraduationCap,
  lessons_25: GraduationCap,
  first_book: BookOpen,
  books_5: Library,
  books_20: Library,
  words_10: Type,
  words_100: Award,
  words_500: Award,
  reviews_100: Repeat,
  perfect_session: Zap,
  streak_3: Flame,
  streak_7: Flame,
  streak_30: Flame,
  streak_100: Flame,
  goal_days_7: Target,
  goal_days_30: Target,
  perfect_week: CalendarCheck,
  xp_100: Star,
  xp_500: Star,
  xp_1000: Trophy,
  xp_5000: Trophy,
  first_chest: Gift,
};

export const ACHIEVEMENTS: Achievement[] = ACHIEVEMENT_DEFS.map((def) => ({
  ...def,
  icon: ICONS[def.id] ?? Award,
  check: (s) => isAchievementEarned(def, s),
}));

// Задача из раздела 5.3: один тип квеста ("слов за неделю"), без движка
// произвольных квестов — расширять только когда реально понадобится второй тип.
export const WEEKLY_QUEST_TARGET = 20;
