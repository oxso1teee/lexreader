"use server";

import { createClient } from "@/lib/supabase/server";
import { buildWeekRecapMoment } from "@/lib/moments/week-recap";
import type { WeekRecapMoment } from "@/lib/moments/types";

// docs/moments/ROADMAP.md, этап 7 — вызывается из WeekRecapGate, тот же
// anon-safe приём, что у fetchWeeklyRankMomentAction/fetchWelcomeBackMomentAction.
export async function fetchWeekRecapMomentAction(): Promise<WeekRecapMoment | null> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;

  const { data: profile } = await supabase.from("profiles").select("target_language").eq("id", user.user.id).maybeSingle();
  if (!profile) return null;

  return buildWeekRecapMoment(supabase, user.user.id, profile.target_language, new Date());
}
