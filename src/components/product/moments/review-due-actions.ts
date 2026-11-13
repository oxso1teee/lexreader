"use server";

import { createClient } from "@/lib/supabase/server";
import { estimateReviewMinutes, getDueCount } from "@/lib/brain-stats";
import { todayUtcIso } from "@/lib/xp-actions";
import type { ReviewDueMoment } from "@/lib/moments/types";

// docs/moments/ROADMAP.md, этап 4 — Review-due: сколько карточек упало
// ниже порога (реально просроченные, getDueCount — тот же счётчик, что уже
// показывает /brain и Welcome-back). Показываем только когда их
// по-настоящему много (не на каждую 1 просроченную карточку — иначе гейт
// срабатывал бы почти ежедневно и потерял смысл тревоги).
const DUE_THRESHOLD = 10;

export async function fetchReviewDueMomentAction(): Promise<ReviewDueMoment | null> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("target_language")
    .eq("id", user.user.id)
    .maybeSingle();
  if (!profile) return null;

  const dueCount = await getDueCount(supabase, user.user.id, profile.target_language);
  if (dueCount < DUE_THRESHOLD) return null;

  // id содержит сегодняшнюю дату — дедуп через localStorage "seen" в
  // moment-provider.tsx естественно не повторяет его в тот же день, как у
  // Weekly-rank/Welcome-back.
  // Первые 5 просроченных слов — чипы на экране (макет Review-due).
  const { data: dueRows } = await supabase
    .from("srs_state")
    .select("due_at, flashcards!inner(front, owner_id, language)")
    .eq("flashcards.owner_id", user.user.id)
    .eq("flashcards.language", profile.target_language)
    .lte("due_at", new Date().toISOString())
    .order("due_at", { ascending: true })
    .limit(5);
  const words = (dueRows ?? [])
    .map((r) => {
      const f = (r as { flashcards: { front: string } | { front: string }[] }).flashcards;
      return (Array.isArray(f) ? f[0]?.front : f?.front) ?? "";
    })
    .filter(Boolean);

  return {
    kind: "review_due",
    id: `review-due-${user.user.id}-${todayUtcIso()}`,
    dueCount,
    words,
    minutes: estimateReviewMinutes(dueCount),
  };
}
