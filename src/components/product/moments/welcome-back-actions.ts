"use server";

import { createClient } from "@/lib/supabase/server";
import { getDueCount } from "@/lib/brain-stats";
import { daysSinceLastActive } from "@/lib/days-since";
import type { WelcomeBackMoment } from "@/lib/moments/types";

const THRESHOLD_DAYS = 3;

// docs/moments/ROADMAP.md, этап 7 — вызывается из WelcomeBackGate (клиент,
// корневой layout.tsx), без requireProfile() — тот же приём, что у
// fetchWeeklyRankMomentAction (анонимный визит лендинга не должен ловить
// редирект только из-за глобально смонтированного гейта).
export async function fetchWelcomeBackMomentAction(): Promise<WelcomeBackMoment | null> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("last_active_date, target_language")
    .eq("id", user.user.id)
    .maybeSingle();
  if (!profile) return null;

  const daysAway = daysSinceLastActive(profile.last_active_date);
  if (daysAway < THRESHOLD_DAYS) return null;

  const [dueReviewCount, { data: lastProgress }] = await Promise.all([
    getDueCount(supabase, user.user.id, profile.target_language),
    supabase
      .from("text_progress")
      .select("text_id, texts!inner(collection_id, collection_order, title)")
      .eq("owner_id", user.user.id)
      .order("last_read_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let continueChapter: WelcomeBackMoment["continueChapter"] = null;
  const text = lastProgress?.texts ? (Array.isArray(lastProgress.texts) ? lastProgress.texts[0] : lastProgress.texts) : null;
  if (lastProgress && text?.collection_id) {
    const [{ data: collection }, { data: siblings }] = await Promise.all([
      supabase.from("collections").select("title").eq("id", text.collection_id).maybeSingle(),
      supabase.from("texts").select("id").eq("collection_id", text.collection_id).order("collection_order", { ascending: true }),
    ]);
    const position = (siblings ?? []).findIndex((s) => s.id === lastProgress.text_id) + 1;
    if (position > 0) {
      continueChapter = { textId: lastProgress.text_id, collectionTitle: collection?.title ?? text.title, chapterPosition: position };
    }
  }

  const name = (user.user.user_metadata?.full_name as string | undefined) ?? user.user.email?.split("@")[0] ?? "снова";

  return {
    kind: "welcome_back",
    id: `welcome-back-${user.user.id}-${profile.last_active_date}`,
    name,
    daysAway,
    dueReviewCount,
    continueChapter,
  };
}
