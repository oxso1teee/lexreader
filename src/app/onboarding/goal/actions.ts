"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// docs/moments/ROADMAP.md, этап 1 — цель дня со слов на XP: 5/10/15/20
// минут → 20/50/80/120 XP (docs/moments/mockups/Goal-pick.dc.html).
// daily_word_goal синхронизируется эвристикой минут×2 — тот же порядок
// величины, что уже стоял по умолчанию (10 слов ~ 5-10 минут).
export const GOAL_TIERS = [
  { minutes: 5, xp: 20, label: "Лёгкий", sub: "Пара страниц за кофе" },
  { minutes: 10, xp: 50, label: "Обычный", sub: "Глава за два дня" },
  { minutes: 15, xp: 80, label: "Серьёзный", sub: "Глава в день" },
  { minutes: 20, xp: 120, label: "Интенсив", sub: "Для тех, кто спешит" },
] as const;

export async function saveGoalAction(minutes: number): Promise<void> {
  const tier = GOAL_TIERS.find((t) => t.minutes === minutes);
  if (!tier) throw new Error("Неизвестная цель дня.");

  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ daily_xp_goal: tier.xp, daily_word_goal: tier.minutes * 2 })
    .eq("id", profile.id);
  if (error) throw new Error("Не удалось сохранить цель.");

  redirect("/onboarding/streak");
}
