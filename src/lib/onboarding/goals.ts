// M3 Slice 9 — primary learning goal (plan doc §4). New field; no goal of
// any kind existed anywhere before this slice. One primary goal only for
// v1 — no secondary goal (the recommendation engine only ever needs one
// topical signal, see learning-paths/recommendation.ts's
// recommendPathFromPlacement).
export type GoalId = "everyday" | "travel" | "work_it" | "study" | "friends_international" | "reading_content" | "general";

export const GOALS: { id: GoalId; label: string }[] = [
  { id: "everyday", label: "Для жизни" },
  { id: "travel", label: "Путешествия" },
  { id: "work_it", label: "Работа / IT" },
  { id: "study", label: "Учёба" },
  { id: "friends_international", label: "Общение" },
  { id: "reading_content", label: "Читать и смотреть контент" },
  { id: "general", label: "Просто улучшить английский" },
];

export function isGoalId(value: string): value is GoalId {
  return GOALS.some((g) => g.id === value);
}
