"use server";

import { STREAK_COMMIT_TIERS } from "./tiers";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// docs/moments/ROADMAP.md, этап 7 — Streak-commit (Streak-commit.dc.html).
// Выбор обязательства по дням серии. Не создаёт новой награды — только
// пишет цель, которую /streak подсвечивает как "твоя цель" раньше
// фиксированных вех STREAK_MILESTONES (src/lib/streak-engine.ts).
export async function saveStreakGoalAction(days: number): Promise<void> {
  const tier = STREAK_COMMIT_TIERS.find((t) => t.days === days);
  if (!tier) throw new Error("Неизвестная цель серии.");

  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ streak_goal_days: tier.days }).eq("id", profile.id);
  if (error) throw new Error("Не удалось сохранить цель.");

  redirect("/onboarding/first-text");
}
