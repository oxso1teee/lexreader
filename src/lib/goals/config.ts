import { DAILY_XP_GOAL_PRESETS, DEFAULT_DAILY_XP_GOAL } from "../daily-goal.ts";
import { pluralRu } from "../plural-ru.ts";

// Тип и размер дневной цели. Тип 'xp' — прежняя цель онбординга (profiles.
// daily_xp_goal: 20/50/80/120 XP) и остаётся значением по умолчанию: выбор
// пользователя не перезаписывается. Остальные типы считаются по реальным
// действиям, которые уже есть в приложении: уроки и упражнения (Iteration 5),
// чтение, повторение слов. Тип, для которого активности нет, в список не
// попадает.

export const GOAL_TYPES = ["xp", "lessons", "exercises", "reading_minutes", "words"] as const;
export type DailyGoalType = (typeof GOAL_TYPES)[number];

export interface GoalTypeDef {
  type: DailyGoalType;
  title: string;
  description: string;
  /** Допустимые размеры цели (выбираются из них; произвольные числа не принимаются). */
  presets: readonly number[];
  defaultTarget: number;
  /** Единица после числа: «20 XP», «2 урока», «10 мин». */
  unit: (n: number) => string;
  /** Подпись под числом на плитке: «XP сегодня». */
  tileLabel: string;
}

export const GOAL_TYPE_DEFS: Readonly<Record<DailyGoalType, GoalTypeDef>> = {
  xp: {
    type: "xp",
    title: "Опыт (XP)",
    description: "Любая учебная активность приносит XP — цель считается по сумме за день.",
    presets: DAILY_XP_GOAL_PRESETS.map((p) => p.xp),
    defaultTarget: DEFAULT_DAILY_XP_GOAL,
    unit: () => "XP",
    tileLabel: "XP сегодня",
  },
  lessons: {
    type: "lessons",
    title: "Уроки",
    description: "Сколько уроков пройти за день. Считаются зачтённые уроки.",
    presets: [1, 2, 3],
    defaultTarget: 1,
    unit: (n) => pluralRu(n, "урок", "урока", "уроков"),
    tileLabel: "уроков сегодня",
  },
  exercises: {
    type: "exercises",
    title: "Упражнения",
    description: "Сколько упражнений выполнить в завершённых уроках и проверках.",
    presets: [5, 10, 20],
    defaultTarget: 10,
    unit: (n) => pluralRu(n, "упражнение", "упражнения", "упражнений"),
    tileLabel: "упражнений сегодня",
  },
  reading_minutes: {
    type: "reading_minutes",
    title: "Чтение",
    description: "Сколько минут читать за день.",
    presets: [5, 10, 20],
    defaultTarget: 10,
    unit: () => "мин",
    tileLabel: "минут чтения",
  },
  words: {
    type: "words",
    title: "Слова",
    description: "Сколько разных слов повторить за день.",
    presets: [10, 20, 40],
    defaultTarget: 20,
    unit: (n) => pluralRu(n, "слово", "слова", "слов"),
    tileLabel: "слов сегодня",
  },
};

export function isGoalType(value: unknown): value is DailyGoalType {
  return typeof value === "string" && (GOAL_TYPES as readonly string[]).includes(value);
}

export interface DailyGoalConfig {
  type: DailyGoalType;
  target: number;
}

export interface GoalProfileFields {
  daily_goal_type?: string | null;
  daily_goal_target?: number | null;
  daily_xp_goal?: number | null;
}

function positiveInt(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

/** Цель из полей профиля. Испорченные значения не ломают экран: неизвестный тип —
 *  XP, битый размер — размер по умолчанию. Для XP размер — daily_xp_goal (онбординг). */
export function resolveGoalConfig(profile: GoalProfileFields): DailyGoalConfig {
  const type = isGoalType(profile.daily_goal_type) ? profile.daily_goal_type : "xp";
  if (type === "xp") return { type, target: positiveInt(profile.daily_xp_goal) ?? DEFAULT_DAILY_XP_GOAL };
  return { type, target: positiveInt(profile.daily_goal_target) ?? GOAL_TYPE_DEFS[type].defaultTarget };
}

export type GoalChoiceValidation = { ok: true; type: DailyGoalType; target: number } | { ok: false };

/** Проверка выбора из формы: тип известен, размер — один из пресетов этого типа. */
export function validateGoalChoice(type: unknown, target: unknown): GoalChoiceValidation {
  if (!isGoalType(type)) return { ok: false };
  if (typeof target !== "number" || !Number.isInteger(target)) return { ok: false };
  return GOAL_TYPE_DEFS[type].presets.includes(target) ? { ok: true, type, target } : { ok: false };
}

/** «20 XP», «2 урока», «10 мин». */
export function formatGoalAmount(type: DailyGoalType, n: number): string {
  return `${n} ${GOAL_TYPE_DEFS[type].unit(n)}`;
}
