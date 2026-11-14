import { GOALS } from "../onboarding/goals.ts";

// Профиль имени не хранит (profiles — только email и настройки), поэтому
// приветствие по имени возможно лишь у тех, кто вошёл через Google/Apple и
// принёс имя в user_metadata. Без него остаётся безличное «Доброе утро!» —
// имя не выдумываем и из email не вытягиваем.
export function firstNameFromMetadata(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  const raw = [m.given_name, m.full_name, m.name].find((v): v is string => typeof v === "string" && v.trim().length > 0);
  return raw?.trim().split(/\s+/)[0] ?? null;
}

/** Подпись основной цели из онбординга (profiles.primary_goal); null — цель не выбрана или значение неизвестно. */
export function learningGoalLabel(primaryGoal: string | null | undefined): string | null {
  if (!primaryGoal) return null;
  return GOALS.find((g) => g.id === primaryGoal)?.label ?? null;
}
