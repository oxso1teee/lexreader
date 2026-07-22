"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { touchStreak } from "@/lib/streak";
import { getPlan, FREE_DAILY_WORD_LIMIT } from "@/lib/subscription";

export interface SaveWordResult {
  ok: boolean;
  paywall?: boolean;
  error?: string;
}

export async function saveWord(input: {
  textId: string;
  headword: string;
  translation: string;
  contextSentence: string;
  contextTranslation: string | null;
}): Promise<SaveWordResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Не авторизован." };

  const plan = await getPlan(supabase, user.id);
  if (plan === "free") {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("vocabulary_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .gte("created_at", todayStart.toISOString());
    if ((count ?? 0) >= FREE_DAILY_WORD_LIMIT) {
      return { ok: false, paywall: true };
    }
  }

  const { error } = await supabase.from("vocabulary_items").insert({
    owner_id: user.id,
    source_text_id: input.textId,
    headword: input.headword,
    translation: input.translation,
    context_sentence: input.contextSentence,
    context_translation: input.contextTranslation,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/notebook");
  return { ok: true };
}

export async function finishReading(input: {
  textId: string;
  minutes: number;
  wordsLookedUp: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const endedAt = new Date();
  const startedAt = new Date(endedAt.getTime() - input.minutes * 60_000);

  const { error } = await supabase.from("reading_sessions").insert({
    owner_id: user.id,
    text_id: input.textId,
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    words_looked_up: input.wordsLookedUp,
  });
  if (error) throw new Error(error.message);

  await touchStreak(supabase, user.id);
  revalidatePath("/progress");
}
