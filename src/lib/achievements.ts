// docs/IMPLEMENTATION_PROMPT_2026-07-28.md, раздел 5.2: каталог достижений —
// фиксированный список в коде (не таблица), чтобы не городить конструктор
// произвольных ачивок заранее. Факт получения хранится в user_achievements.

export interface AchievementStats {
  totalWords: number;
  finishedTexts: number;
  currentStreak: number;
  bestSessionCount: number;
}

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  check: (s: AchievementStats) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "streak_7",
    icon: "🔥",
    title: "Неделя подряд",
    description: "7 дней подряд в приложении",
    check: (s) => s.currentStreak >= 7,
  },
  {
    id: "words_100",
    icon: "💯",
    title: "Сто слов",
    description: "100 сохранённых слов",
    check: (s) => s.totalWords >= 100,
  },
  {
    id: "first_book",
    icon: "📖",
    title: "Первая книга",
    description: "Дочитан первый текст до конца",
    check: (s) => s.finishedTexts >= 1,
  },
  {
    id: "perfect_session",
    icon: "⚡",
    title: "Идеальная сессия",
    description: "Личный рекорд повторения — 20+ карточек за раз",
    check: (s) => s.bestSessionCount >= 20,
  },
];

// Задача из раздела 5.3: один тип квеста ("слов за неделю"), без движка
// произвольных квестов — расширять только когда реально понадобится второй тип.
export const WEEKLY_QUEST_TARGET = 20;
