// M3 UI slice 2 — Progress redesign, "Skill section": до Language Twin
// приложение не может честно утверждать реальный Speaking/Listening/Grammar/
// CEFR-уровень (см. docs/ui/slice2-data-audit.md) — вместо выдуманных оценок
// показываем статус ПОЛНОТЫ ДАННЫХ по измеряемым направлениям (сколько
// реальных событий накоплено), не оценку качества/уровня.
export type SkillStatus = "few_data" | "collecting" | "trending";

const COLLECTING_THRESHOLD = 1;
const TRENDING_THRESHOLD = 5;

export function skillStatus(eventCount: number): SkillStatus {
  const count = Math.max(0, eventCount);
  if (count >= TRENDING_THRESHOLD) return "trending";
  if (count >= COLLECTING_THRESHOLD) return "collecting";
  return "few_data";
}

export const SKILL_STATUS_LABEL: Record<SkillStatus, string> = {
  few_data: "Мало данных",
  collecting: "Собираем данные",
  trending: "Есть тенденция",
};
