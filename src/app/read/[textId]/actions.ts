"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { touchStreak } from "@/lib/streak";
import { getPlan, FREE_DAILY_WORD_LIMIT } from "@/lib/subscription";
import { statusFromLevel } from "@/lib/word-level";

export interface UpsertWordResult {
  ok: boolean;
  paywall?: boolean;
  error?: string;
  id?: string;
  level?: number;
  seenCount?: number;
}

function todayStartUtc(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export async function upsertWord(input: {
  textId: string;
  headword: string;
  translation: string;
  contextSentence: string;
  contextTranslation: string | null;
}): Promise<UpsertWordResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Не авторизован." };

  const { data: existing } = await supabase
    .from("vocabulary_items")
    .select("id, level, seen_count")
    .eq("owner_id", user.id)
    .ilike("headword", input.headword)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("vocabulary_items")
      .update({ seen_count: existing.seen_count + 1 })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: existing.id, level: existing.level, seenCount: existing.seen_count + 1 };
  }

  const plan = await getPlan(supabase, user.id);
  if (plan === "free") {
    const { count } = await supabase
      .from("vocabulary_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", user.id)
      .gte("created_at", todayStartUtc());
    if ((count ?? 0) >= FREE_DAILY_WORD_LIMIT) {
      return { ok: false, paywall: true };
    }
  }

  const { data: created, error } = await supabase
    .from("vocabulary_items")
    .insert({
      owner_id: user.id,
      source_text_id: input.textId,
      headword: input.headword,
      translation: input.translation,
      context_sentence: input.contextSentence,
      context_translation: input.contextTranslation,
    })
    .select("id, level, seen_count")
    .single();
  if (error || !created) return { ok: false, error: error?.message ?? "Не удалось сохранить слово." };

  revalidatePath("/notebook");
  return { ok: true, id: created.id, level: created.level, seenCount: created.seen_count };
}

export async function setWordLevel(vocabularyItemId: string, level: 0 | 1 | 2 | 3 | 4) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("vocabulary_items")
    .update({ level, status: statusFromLevel(level) })
    .eq("id", vocabularyItemId);
  if (error) throw new Error(error.message);
  revalidatePath("/notebook");
}

export async function addPhraseToDefaultDeck(front: string, back: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: deck } = await supabase
    .from("decks")
    .select("id")
    .eq("owner_id", user.id)
    .eq("is_default", true)
    .maybeSingle();
  if (!deck) throw new Error("Основная колода не найдена.");

  const { data: card, error } = await supabase
    .from("flashcards")
    .insert({ deck_id: deck.id, owner_id: user.id, front, back })
    .select("id")
    .single();
  if (error || !card) throw new Error(error?.message ?? "Не удалось добавить карточку.");

  const { data: settings } = await supabase
    .from("srs_settings")
    .select("starting_ease")
    .eq("owner_id", user.id)
    .maybeSingle();

  await supabase
    .from("srs_state")
    .insert({ flashcard_id: card.id, ease_factor: settings?.starting_ease ?? 2.5 });

  revalidatePath("/brain");
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
