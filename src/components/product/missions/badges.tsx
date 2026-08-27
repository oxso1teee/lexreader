import type { MissionDifficulty, MissionPriority, MissionType } from "@/lib/missions/types";

// Same "text-safe variant, verified accessible pair" convention as
// components/product/language-twin/badges.tsx — no ad hoc colors.
const MISSION_TYPE_LABEL: Record<MissionType, string> = {
  grammar_pattern: "Грамматика",
  vocab_activation: "Активация слов",
  review_recovery: "Забытые слова",
  reading: "Чтение",
  phrase_activation: "Фразы",
  correction: "Разбор ошибки",
  diagnostic_followup: "По диагностике",
  maintenance: "Поддержка",
  onboarding: "Знакомство",
};

export function missionTypeLabel(type: MissionType): string {
  return MISSION_TYPE_LABEL[type] ?? type;
}

const PRIORITY_LABEL: Record<MissionPriority, string> = {
  high: "Сейчас важно",
  medium: "Стоит сделать",
  low: "Не срочно",
};
const PRIORITY_CLASS: Record<MissionPriority, string> = {
  high: "bg-[var(--color-warning)]/15 text-[var(--color-warning-text)]",
  medium: "bg-[var(--color-info)]/15 text-[var(--color-info-text)]",
  low: "bg-black/5 text-[var(--text-secondary)] dark:bg-white/10",
};

// Deliberately no numeric score anywhere in the UI (plan doc §6/artifact) —
// only this 3-value label, never "78% match" or similar fake precision.
export function MissionPriorityBadge({ priority }: { priority: MissionPriority }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_CLASS[priority]}`}>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

const DIFFICULTY_LABEL: Record<MissionDifficulty, string> = {
  easy: "Лёгкая",
  medium: "Средняя",
  hard: "Сложная",
};

export function difficultyLabel(difficulty: MissionDifficulty): string {
  return DIFFICULTY_LABEL[difficulty];
}

export function MissionTypeBadge({ type }: { type: MissionType }) {
  return (
    <span className="rounded-full bg-beige px-2 py-0.5 text-xs font-medium text-[var(--color-forest-text)]">
      {missionTypeLabel(type)}
    </span>
  );
}
