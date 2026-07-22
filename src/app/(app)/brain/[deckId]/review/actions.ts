"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { touchStreak } from "@/lib/streak";
import { reviewSrsState } from "@/lib/srs";
import { getSrsParams } from "@/lib/srs-settings";

export async function reviewWord(flashcardId: string, grade: 0 | 1 | 2 | 3) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const [{ data: current, error: fetchError }, params] = await Promise.all([
    supabase
      .from("srs_state")
      .select("ease_factor, interval_days, repetitions")
      .eq("flashcard_id", flashcardId)
      .single(),
    getSrsParams(supabase, user.id),
  ]);
  if (fetchError || !current) throw new Error(fetchError?.message ?? "Карточка не найдена");

  const next = reviewSrsState(
    {
      easeFactor: current.ease_factor,
      intervalDays: current.interval_days,
      repetitions: current.repetitions,
    },
    grade,
    params,
  );

  const now = new Date();
  const dueAt = new Date(now.getTime() + next.intervalDays * 86_400_000);

  const { error: updateError } = await supabase
    .from("srs_state")
    .update({
      ease_factor: next.easeFactor,
      interval_days: next.intervalDays,
      repetitions: next.repetitions,
      due_at: dueAt.toISOString(),
      last_reviewed_at: now.toISOString(),
    })
    .eq("flashcard_id", flashcardId);
  if (updateError) throw new Error(updateError.message);

  const { error: logError } = await supabase
    .from("review_log")
    .insert({ flashcard_id: flashcardId, grade });
  if (logError) throw new Error(logError.message);

  await touchStreak(supabase, user.id);
  revalidatePath("/brain");
  revalidatePath("/progress");
}

export async function getCurrentStreak(): Promise<number> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data } = await supabase
    .from("profiles")
    .select("streak_current")
    .eq("id", user.id)
    .single();

  return data?.streak_current ?? 0;
}
