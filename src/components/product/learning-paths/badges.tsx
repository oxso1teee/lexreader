import { Check, Circle, Dumbbell, RefreshCw, Sprout, TrendingUp, type LucideIcon } from "lucide-react";
import type { SkillConfidence, SkillStatus } from "@/lib/learning-paths/types";

// M3 Slice 8 — never color-only (plan doc's accessibility requirement):
// every badge pairs an icon + text label, color is a reinforcement only.
// redesign/duolingo-flat phase 2: ○◐◑◕✓ glyphs → lucide (one icon system).
const STATUS_META: Record<SkillStatus, { icon: LucideIcon; label: string; className: string }> = {
  not_started: { icon: Circle, label: "Не начато", className: "bg-[var(--border)] text-[var(--text-secondary)]" },
  introduced: { icon: Sprout, label: "Изучается", className: "bg-[var(--color-info)]/15 text-[var(--color-info-text)]" },
  practicing: { icon: Dumbbell, label: "Практика", className: "bg-[var(--color-info)]/15 text-[var(--color-info-text)]" },
  improving: { icon: TrendingUp, label: "Улучшается", className: "bg-[var(--color-warning)]/15 text-[var(--color-warning-text)]" },
  confident: { icon: Check, label: "Уверенно", className: "bg-[var(--color-success)]/15 text-[var(--color-success-text)]" },
  maintenance: { icon: RefreshCw, label: "Поддержка", className: "bg-[var(--color-success)]/15 text-[var(--color-success-text)]" },
};

export function skillStatusLabel(status: SkillStatus): string {
  return STATUS_META[status].label;
}

export function SkillStatusBadge({ status }: { status: SkillStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${meta.className}`}>
      <Icon aria-hidden="true" className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

const CONFIDENCE_META: Record<SkillConfidence, { label: string; className: string }> = {
  low: { label: "Уверенность: низкая", className: "bg-[var(--border)] text-[var(--text-secondary)]" },
  medium: { label: "Уверенность: средняя", className: "bg-[var(--color-warning)]/15 text-[var(--color-warning-text)]" },
  high: { label: "Уверенность: высокая", className: "bg-[var(--color-success)]/15 text-[var(--color-success-text)]" },
};

export function SkillConfidenceBadge({ confidence }: { confidence: SkillConfidence }) {
  const meta = CONFIDENCE_META[confidence];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.className}`}>{meta.label}</span>;
}
