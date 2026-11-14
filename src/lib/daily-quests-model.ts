import { pluralRu } from "./plural-ru.ts";
import type { DailyActivity } from "./goals/activity.ts";

// Чистая модель ежедневных заданий: типы, названия, статусы жизненного цикла и
// сборка элементов для экрана. Без обращений к БД и серверных зависимостей — этот
// модуль безопасно импортировать из клиентских компонентов. Генерация набора,
// хранение и выдача сундука — в daily-quests.ts (серверная часть).

export type DailyQuestType =
  | "read_minutes"
  | "review_words"
  | "combo_streak"
  | "earn_xp"
  | "complete_lessons"
  | "answer_exercises";

export const QUEST_TYPES: readonly DailyQuestType[] = [
  "read_minutes",
  "review_words",
  "combo_streak",
  "earn_xp",
  "complete_lessons",
  "answer_exercises",
];

export function isQuestType(value: unknown): value is DailyQuestType {
  return typeof value === "string" && (QUEST_TYPES as readonly string[]).includes(value);
}

export interface DailyQuestDef {
  questType: DailyQuestType;
  target: number;
}

/** Сколько заданий в наборе дня. Сундук открывается, когда выполнены все. */
export const QUESTS_PER_DAY = 3;

export type DailyQuestProgress = Record<DailyQuestType, number>;

/** Прогресс заданий из активности дня — те же факты, что у дневной цели. */
export function questProgressFromActivity(activity: Pick<DailyActivity, "readingMinutes" | "reviewedWords" | "correctStreak" | "xp" | "lessons" | "exercises">): DailyQuestProgress {
  return {
    read_minutes: activity.readingMinutes,
    review_words: activity.reviewedWords,
    combo_streak: activity.correctStreak,
    earn_xp: activity.xp,
    complete_lessons: activity.lessons,
    answer_exercises: activity.exercises,
  };
}

/** progress[d.questType] >= d.target для каждого d — честная проверка "все задания выполнены".
 *  Пустой набор не считается выполненным: иначе сбой генерации открывал бы сундук. */
export function allQuestsComplete(defs: readonly DailyQuestDef[], progress: Partial<DailyQuestProgress>): boolean {
  return defs.length > 0 && defs.every((d) => (progress[d.questType] ?? 0) >= d.target);
}

// ---------- жизненный цикл ----------

/** Доступно → В процессе → Выполнено → Награда получена; день прошёл без награды — Истекло. */
export type QuestStatus = "available" | "in_progress" | "completed" | "claimed" | "expired";

export function questStatus(input: { current: number; target: number; day: string; today: string; claimed: boolean }): QuestStatus {
  if (input.claimed) return "claimed";
  if (input.day < input.today) return "expired";
  if (input.current >= input.target) return "completed";
  if (input.current > 0) return "in_progress";
  return "available";
}

export const QUEST_STATUS_LABEL: Readonly<Record<QuestStatus, string>> = {
  available: "Доступно",
  in_progress: "В процессе",
  completed: "Выполнено",
  claimed: "Награда получена",
  expired: "Истекло",
};

export function questTitle(type: DailyQuestType, target: number): string {
  switch (type) {
    case "read_minutes":
      return `Прочитать ${target} ${pluralRu(target, "минуту", "минуты", "минут")}`;
    case "review_words":
      return `Повторить ${target} ${pluralRu(target, "слово", "слова", "слов")}`;
    case "combo_streak":
      return `${target} ${pluralRu(target, "верный", "верных", "верных")} подряд`;
    case "earn_xp":
      return `Заработать ${target} XP`;
    case "complete_lessons":
      return `Пройти ${target} ${pluralRu(target, "урок", "урока", "уроков")}`;
    case "answer_exercises":
      return `Выполнить ${target} ${pluralRu(target, "упражнение", "упражнения", "упражнений")}`;
  }
}

export interface DailyQuestItem extends DailyQuestDef {
  current: number;
  status: QuestStatus;
  done: boolean;
}

export function buildQuestItems(
  defs: readonly DailyQuestDef[],
  progress: DailyQuestProgress,
  context: { day: string; today: string; claimed: boolean },
): DailyQuestItem[] {
  return defs.map((def) => {
    const current = Math.min(progress[def.questType] ?? 0, def.target);
    return {
      ...def,
      current,
      done: current >= def.target,
      status: questStatus({ current, target: def.target, day: context.day, today: context.today, claimed: context.claimed }),
    };
  });
}
