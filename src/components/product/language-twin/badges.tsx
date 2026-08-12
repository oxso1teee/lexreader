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
  low: "bg-black/5 text-[var(--text-secondary)] dark:bg-white/10",
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

const STATUS_LABEL: Record<PatternStatus, string> = {
  active: "● Активный",
  improving: "● Улучшается",
  resolved: "✓ Решено",
  uncertain: "? Не уверены",
  dismissed: "Скрыт",
};
const STATUS_CLASS: Record<PatternStatus, string> = {
  active: "bg-[var(--color-warning)]/15 text-[var(--color-warning-text)]",
  improving: "bg-[var(--color-info)]/15 text-[var(--color-info)]",
  resolved: "bg-[var(--color-success)]/15 text-[var(--color-success-text)]",
  uncertain: "bg-black/5 text-[var(--text-secondary)] dark:bg-white/10",
  dismissed: "bg-black/5 text-[var(--text-secondary)] dark:bg-white/10",
};

export function StatusBadge({ status }: { status: PatternStatus }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export function TrendIndicator({ trend }: { trend: Trend }) {
  if (trend === "up") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-success-text)]">
        ▲ растёт<span className="sr-only"> (положительная динамика)</span>
      </span>
    );
  }
  if (trend === "down") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-danger-text)]">
        ▼ снижается<span className="sr-only"> (отрицательная динамика)</span>
      </span>
    );
  }
  return <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)]">— стабильно</span>;
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
    <span className="rounded-full bg-beige px-2 py-0.5 text-xs font-medium text-[var(--color-caramel-text)]">
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
};

export function reasonLabel(reasonKey: string): string {
  return REASON_LABEL[reasonKey] ?? reasonKey;
}
