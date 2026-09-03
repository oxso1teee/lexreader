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
// The dot variant below reuses this text as its accessible name — real
// solid colors, not the /15-tinted background above, since a 2x2px dot has
// no room for the badge's own text-on-tint contrast pairing.
const PRIORITY_DOT_CLASS: Record<MissionPriority, string> = {
  high: "bg-[var(--color-warning)]",
  medium: "bg-[var(--color-info)]",
  low: "bg-[var(--border-strong)]",
};

export function priorityLabel(priority: MissionPriority): string {
  return PRIORITY_LABEL[priority];
}

// Deliberately no numeric score anywhere in the UI (plan doc §6/artifact) —
// only this 3-value label, never "78% match" or similar fake precision.
export function MissionPriorityBadge({ priority }: { priority: MissionPriority }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${PRIORITY_CLASS[priority]}`}>
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

// Missions mockup alignment — mission-card.tsx's compact row has no space
// for the full text pill above; same 3-value priority, same "no numeric
// score" rule, just a solid-color dot instead of a tinted text pill. Real
// accessible name via aria-label (not aria-hidden — this is the only
// on-screen carrier of priority in the compact row, not decorative).
// Contrast (hand-verified, WCAG non-text 3:1): high/medium use real
// --color-warning/--color-info solids (~3.56-4.65:1 and ~3.2-5.17:1 across
// both themes) — real signals, need to actually be seen. "low" reuses
// --border-strong, the same intentionally-muted "nothing to see here"
// token review-session.tsx's unfilled progress dots already use — low
// priority is meant to visually recede, aria-label still carries the real
// label for anyone who can't see it either way.
export function MissionPriorityDot({ priority }: { priority: MissionPriority }) {
  return (
    <span
      role="img"
      aria-label={`Приоритет: ${PRIORITY_LABEL[priority]}`}
      title={PRIORITY_LABEL[priority]}
      className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT_CLASS[priority]}`}
    />
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
