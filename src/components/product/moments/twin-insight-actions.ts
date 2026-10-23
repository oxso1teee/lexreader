"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrCreateSettingsSafe } from "@/lib/language-twin/settings";
import { pickTopPattern } from "@/lib/language-twin/recompute";
import { MIN_EVIDENCE_FOR_PROFILE } from "@/lib/language-twin/constants";
import type { PatternCategory, PatternRow } from "@/lib/language-twin/types";
import type { TwinInsightMoment, TwinInsightSkillDelta } from "@/lib/moments/types";
import { isoWeekStart } from "@/lib/iso-week";

// Тот же человекочитаемый ярлык категории, что CategoryBadge на
// /language-twin — своя маленькая копия (та же категория небольших
// дублирующихся форматтеров, что dayLabel в progress/page.tsx), не
// переиспользуем клиентский компонент из server action.
const CATEGORY_LABEL: Record<PatternCategory, string> = {
  activation: "Активация словаря",
  review_recall: "Вспоминание на повторении",
  article: "Артикли",
  preposition: "Предлоги",
  word_order: "Порядок слов",
  tense: "Времена",
  passive: "Пассивный залог",
  gerund_infinitive: "Герундий/инфинитив",
  possession: "Притяжательность",
  collocation: "Сочетаемость слов",
  spelling: "Орфография",
  other: "Другое",
  comparative: "Сравнение",
  modal: "Модальные глаголы",
  relative_clause: "Относительные придаточные",
  conditional: "Условные предложения",
  question_formation: "Построение вопросов",
};

const MONTHS_RU = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
function weekLabel(weekStart: Date): string {
  const end = new Date(weekStart.getTime() + 6 * 86_400_000);
  const sameMonth = weekStart.getUTCMonth() === end.getUTCMonth();
  const startStr = sameMonth ? `${weekStart.getUTCDate()}` : `${weekStart.getUTCDate()} ${MONTHS_RU[weekStart.getUTCMonth()]}`;
  return `${startStr}–${end.getUTCDate()} ${MONTHS_RU[end.getUTCMonth()]}`;
}

function statusOf(confidence: PatternRow["confidence"]): TwinInsightSkillDelta["status"] {
  if (confidence === "high") return "strong";
  if (confidence === "medium") return "developing";
  return "weak";
}

// docs/moments/ROADMAP.md, этап 4 — Twin-insight. Переиспользует ровно те
// же данные, что уже честно считает recomputeLanguageTwin() (language-
// twin/summary.ts делает то же самое для карточки на /progress) — здесь
// просто разворачивается в несколько реальных паттернов с их настоящим
// trend/confidence, не в выдуманную "обновлённую оценку".
export async function fetchTwinInsightMomentAction(): Promise<TwinInsightMoment | null> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;

  const settings = await getOrCreateSettingsSafe(supabase, user.user.id);
  if (!settings || !settings.enabled) return null;

  const { count: evidenceCount } = await supabase
    .from("language_evidence")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.user.id)
    .is("deleted_at", null);
  if ((evidenceCount ?? 0) < MIN_EVIDENCE_FOR_PROFILE) return null;

  const { data: patternsData } = await supabase
    .from("language_error_patterns")
    .select("*")
    .eq("user_id", user.user.id)
    .in("status", ["active", "improving", "uncertain"])
    .order("evidence_count", { ascending: false })
    .limit(4);
  const patterns = (patternsData ?? []) as PatternRow[];
  if (patterns.length === 0) return null;

  const topPattern = pickTopPattern(patterns);
  const weekStart = isoWeekStart(new Date());

  return {
    kind: "twin_insight",
    id: `twin-insight-${user.user.id}-${weekStart.toISOString().slice(0, 10)}`,
    weekLabel: weekLabel(weekStart),
    skills: patterns.map((p) => ({
      category: p.category,
      label: CATEGORY_LABEL[p.category] ?? p.category,
      trend: p.trend,
      status: statusOf(p.confidence),
    })),
    focusLabel: topPattern?.title ?? null,
  };
}
