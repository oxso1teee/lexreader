import type { SkillConfidence, SkillStatus } from "@/lib/learning-paths/types";

// M3 Slice 8 — never color-only (plan doc's accessibility requirement):
// every badge pairs an icon + text label, color is a reinforcement only.
const STATUS_META: Record<SkillStatus, { icon: string; label: string; className: string }> = {
  not_started: { icon: "○", label: "Не начато", className: "bg-black/5 text-[var(--text-secondary)] dark:bg-white/10" },
  introduced: { icon: "◐", label: "Изучается", className: "bg-[var(--color-info)]/15 text-[var(--color-info)]" },
  practicing: { icon: "◑", label: "Практика", className: "bg-[var(--color-info)]/15 text-[var(--color-info)]" },
  improving: { icon: "◕", label: "Улучшается", className: "bg-[var(--color-warning)]/15 text-[var(--color-warning-text)]" },
  confident: { icon: "✓", label: "Уверенно", className: "bg-[var(--color-success)]/15 text-[var(--color-success-text)]" },
  maintenance: { icon: "✓", label: "Поддержка", className: "bg-[var(--color-success)]/15 text-[var(--color-success-text)]" },
};

export function skillStatusLabel(status: SkillStatus): string {
  return STATUS_META[status].label;
}

export function SkillStatusBadge({ status }: { status: SkillStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${meta.className}`}>
      <span aria-hidden="true">{meta.icon}</span>
      {meta.label}
    </span>
  );
}

const CONFIDENCE_META: Record<SkillConfidence, { label: string; className: string }> = {
  low: { label: "Уверенность: низкая", className: "bg-black/5 text-[var(--text-secondary)] dark:bg-white/10" },
  medium: { label: "Уверенность: средняя", className: "bg-[var(--color-warning)]/15 text-[var(--color-warning-text)]" },
  high: { label: "Уверенность: высокая", className: "bg-[var(--color-success)]/15 text-[var(--color-success-text)]" },
};

export function SkillConfidenceBadge({ confidence }: { confidence: SkillConfidence }) {
  const meta = CONFIDENCE_META[confidence];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.className}`}>{meta.label}</span>;
}
