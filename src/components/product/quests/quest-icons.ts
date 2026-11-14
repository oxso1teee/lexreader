import type { DailyQuestType } from "@/lib/daily-quests-model";

// Значки заданий дня. Отдельный модуль без "use client": ими пользуются и клиентская
// карточка на главной, и серверная доска на /rewards (значение, экспортированное из
// клиентского файла, на сервере превращается в client reference, а не в объект).
export const QUEST_ICON: Readonly<Record<DailyQuestType, string>> = {
  read_minutes: "📖",
  review_words: "🗂",
  combo_streak: "🔥",
  earn_xp: "⚡",
  complete_lessons: "🎓",
  answer_exercises: "✏️",
};
