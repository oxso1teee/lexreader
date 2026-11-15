import { Check, Circle, Dumbbell, RefreshCw, Sprout, TrendingUp, type LucideIcon } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { SkillConfidence, SkillStatus } from "@/lib/learning-paths/types";

// M3 Slice 8 — never color-only (plan doc's accessibility requirement):
// every badge pairs an icon + text label, color is a reinforcement only.
// Phase 2, итерация 4: на Badge из UI-кита и токенах Ultimate DS (обе темы
// берутся из токенов, без своих цветов).
const STATUS_META: Record<SkillStatus, { icon: LucideIcon; label: string; tone: BadgeTone }> = {
  not_started: { icon: Circle, label: "Не начато", tone: "neutral" },
  introduced: { icon: Sprout, label: "Изучается", tone: "sky" },
  practicing: { icon: Dumbbell, label: "Практика", tone: "sky" },
  improving: { icon: TrendingUp, label: "Улучшается", tone: "sun" },
  confident: { icon: Check, label: "Уверенно", tone: "leaf" },
  maintenance: { icon: RefreshCw, label: "Поддержка", tone: "leaf" },
};

export function skillStatusLabel(status: SkillStatus): string {
  return STATUS_META[status].label;
}

export function SkillStatusBadge({ status }: { status: SkillStatus }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <Badge tone={meta.tone}>
      <Icon aria-hidden="true" className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

const CONFIDENCE_META: Record<SkillConfidence, { label: string; tone: BadgeTone }> = {
  low: { label: "Уверенность: низкая", tone: "neutral" },
  medium: { label: "Уверенность: средняя", tone: "sun" },
  high: { label: "Уверенность: высокая", tone: "leaf" },
};

export function SkillConfidenceBadge({ confidence }: { confidence: SkillConfidence }) {
  const meta = CONFIDENCE_META[confidence];
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}
