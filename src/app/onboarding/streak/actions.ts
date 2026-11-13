"use server";

import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// docs/moments/ROADMAP.md, этап 7 — Streak-commit (Streak-commit.dc.html).
// Выбор обязательства по дням серии. Не создаёт новой награды — только
// пишет цель, которую /streak подсвечивает как "твоя цель" раньше
// фиксированных вех STREAK_MILESTONES (src/lib/streak-engine.ts).
export const STREAK_COMMIT_TIERS = [
  { days: 7, word: "хороший старт", reward: "Сундук за первую неделю" },
  { days: 14, word: "уже привычка", reward: "Сундук и бейдж «Две недели»" },
  { days: 30, word: "серьёзно", reward: "Сундук, бейдж и рамка аватара" },
  { days: 50, word: "железная воля", reward: "Всё выше и золотой огонёк" },
] as const;

export async function saveStreakGoalAction(days: number): Promise<void> {
  const tier = STREAK_COMMIT_TIERS.find((t) => t.days === days);
  if (!tier) throw new Error("Неизвестная цель серии.");

  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ streak_goal_days: tier.days }).eq("id", profile.id);
  if (error) throw new Error("Не удалось сохранить цель.");

  redirect("/onboarding/first-text");
}
