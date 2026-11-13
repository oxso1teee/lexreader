"use server";

import { createClient } from "@/lib/supabase/server";
import { maybeBuildWeeklyRankMoment } from "@/lib/moments/weekly-rank";
import type { WeeklyRankMoment } from "@/lib/moments/types";

// docs/moments/ROADMAP.md, этап 6 — вызывается из WeeklyRankGate (клиент,
// на КАЖДОЙ странице приложения, через корневой layout.tsx) — намеренно без
// requireProfile() (который редиректит): анонимный посетитель лендинга не
// должен словить редирект только из-за того, что этот гейт смонтирован
// глобально. Тихо возвращает null, если сессии нет.
export async function fetchWeeklyRankMomentAction(): Promise<WeeklyRankMoment | null> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;
  return maybeBuildWeeklyRankMoment(supabase, user.user.id, new Date());
}
