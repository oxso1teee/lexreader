"use server";

import { createClient } from "@/lib/supabase/server";
import { getDueCount } from "@/lib/brain-stats";
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
  return { kind: "review_due", id: `review-due-${user.user.id}-${todayUtcIso()}`, dueCount };
}
