import type { LearningState } from "@/lib/vocabulary-list";

// M3 Slice 11 (plan doc §2) — extracted from brain/vocabulary/[id]/detail-view.tsx so the
// Reader word panel can show the same real learning_state label without duplicating the copy.
export const LEARNING_STATE_LABEL: Record<LearningState, string> = {
  new: "Новое",
  learning: "Учу",
  familiar: "Знакомое",
  active: "Активное",
  maintenance: "Поддерживается",
};
