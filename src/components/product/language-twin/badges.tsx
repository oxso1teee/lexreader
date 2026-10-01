import { Check, CircleDot, HelpCircle, Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import type { ConfidenceLevel, PatternCategory, PatternStatus, Trend } from "@/lib/language-twin/types";

// Same "text-safe variant only for text, not background" convention as
// skill-status.tsx (src/lib/skill-status.ts) and tokens.css's -text tokens —
// verified accessible pairs, not ad hoc colors.
const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  low: "Уверенность: низкая",
  medium: "Уверенность: средняя",
  high: "Уверенность: высокая",
};
const CONFIDENCE_CLASS: Record<ConfidenceLevel, string> = {
  low: "bg-[var(--border)] text-[var(--text-secondary)]",
  medium: "bg-[var(--color-warning)]/15 text-[var(--color-warning-text)]",
  high: "bg-[var(--color-success)]/15 text-[var(--color-success-text)]",
};

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${CONFIDENCE_CLASS[level]}`}>
      {CONFIDENCE_LABEL[level]}
    </span>
  );
}

// redesign/duolingo-flat phase 2: ●/✓/?/▲/▼ glyphs → lucide (one icon system).
const STATUS_LABEL: Record<PatternStatus, string> = {
  active: "Активный",
  improving: "Улучшается",
  resolved: "Решено",
  uncertain: "Не уверены",
  dismissed: "Скрыт",
};
const STATUS_ICON: Partial<Record<PatternStatus, LucideIcon>> = {
  active: CircleDot,
  improving: TrendingUp,
  resolved: Check,
  uncertain: HelpCircle,
};
const STATUS_CLASS: Record<PatternStatus, string> = {
  active: "bg-[var(--color-warning)]/15 text-[var(--color-warning-text)]",
  improving: "bg-[var(--color-info)]/15 text-[var(--color-info-text)]",
  resolved: "bg-[var(--color-success)]/15 text-[var(--color-success-text)]",
  uncertain: "bg-[var(--border)] text-[var(--text-secondary)]",
  dismissed: "bg-[var(--border)] text-[var(--text-secondary)]",
};

export function StatusBadge({ status }: { status: PatternStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]}`}>
      {Icon && <Icon aria-hidden="true" className="h-3 w-3" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

export function TrendIndicator({ trend }: { trend: Trend }) {
  if (trend === "up") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-success-text)]">
        <TrendingUp aria-hidden="true" className="h-3.5 w-3.5" />
        растёт<span className="sr-only"> (положительная динамика)</span>
      </span>
    );
  }
  if (trend === "down") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-danger-text)]">
        <TrendingDown aria-hidden="true" className="h-3.5 w-3.5" />
        снижается<span className="sr-only"> (отрицательная динамика)</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)]">
      <Minus aria-hidden="true" className="h-3.5 w-3.5" />
      стабильно
    </span>
  );
}

const CATEGORY_LABEL: Record<PatternCategory, string> = {
  activation: "Активация словаря",
  review_recall: "Повторение",
  article: "Артикли",
  preposition: "Предлоги",
  word_order: "Порядок слов",
  tense: "Времена",
  passive: "Passive",
  gerund_infinitive: "Gerund/Infinitive",
  possession: "Притяжательность",
  collocation: "Коллокации",
  spelling: "Орфография",
  other: "Другое",
  comparative: "Сравнения",
  modal: "Модальные глаголы",
  relative_clause: "Придаточные предложения",
  conditional: "Условные предложения",
  question_formation: "Построение вопросов",
};

export function categoryLabel(category: PatternCategory): string {
  return CATEGORY_LABEL[category] ?? category;
}

export function CategoryBadge({ category }: { category: PatternCategory }) {
  return (
    <span className="rounded-full bg-beige px-2 py-0.5 text-xs font-medium text-[var(--color-forest-text)]">
      {categoryLabel(category)}
    </span>
  );
}

const REASON_LABEL: Record<string, string> = {
  activation_gap: "Это самый обеспеченный доказательствами паттерн активации сейчас",
  repeated_failure: "Паттерн повторяется без изменений",
  grammar_pattern: "Найден в проверке предложений",
  insufficient_evidence: "Пока мало данных для точных выводов",
  no_active_patterns: "Активных паттернов нет — можно просто поддерживать темп",
  maintenance: "Паттерн уже улучшился — короткая проверка, чтобы закрепить",
  diagnostic_followup: "Слабое место по результатам мини-диагностики",
  phrase_activation: "Сохранённые фразы ещё не закрепились в памяти",
  familiar_vocab_ready: "Ты узнаёшь эти слова, осталось закрепить активным вспоминанием",
};

export function reasonLabel(reasonKey: string): string {
  return REASON_LABEL[reasonKey] ?? reasonKey;
}
