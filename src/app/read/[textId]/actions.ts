"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { touchStreak } from "@/lib/streak";
import { statusFromLevel } from "@/lib/word-level";
import { saveVocabularyItem, type UpsertWordResult } from "@/lib/vocabulary";
import { hasFreeFlashcardRoom } from "@/lib/subscription";

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

  // P0-АУДИТ 3.9: язык слова берём из самого текста-источника (не доверяем
  // клиенту) — иначе слово может "склеиться" с одноимённым в другом языке.
  const { data: text } = await supabase
    .from("texts")
    .select("language")
    .eq("id", input.textId)
    .maybeSingle();
  if (!text) return { ok: false, error: "Текст не найден." };

  const result = await saveVocabularyItem(supabase, user.id, {
    textId: input.textId,
    headword: input.headword,
    translation: input.translation,
    contextSentence: input.contextSentence,
    contextTranslation: input.contextTranslation,
    language: text.language,
  });
  if (result.ok) revalidatePath("/notebook");
  return result;
}

export async function setWordLevel(vocabularyItemId: string, level: 0 | 1 | 2 | 3 | 4) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("vocabulary_items")
    .update({ level, status: statusFromLevel(level) })
    .eq("id", vocabularyItemId);
  if (error) throw new Error("Не удалось сохранить уровень слова.");
  revalidatePath("/notebook");
}

export interface AddPhraseResult {
  ok: boolean;
  paywall?: boolean;
  error?: string;
}

export async function addPhraseToDefaultDeck(front: string, back: string): Promise<AddPhraseResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Не авторизован." };

  if (!(await hasFreeFlashcardRoom(supabase, user.id))) {
    return { ok: false, paywall: true };
  }

  const { data: deck } = await supabase
    .from("decks")
    .select("id")
    .eq("owner_id", user.id)
    .eq("is_default", true)
    .maybeSingle();
  if (!deck) return { ok: false, error: "Основная колода не найдена." };

  const { data: card, error } = await supabase
    .from("flashcards")
    .insert({ deck_id: deck.id, owner_id: user.id, front, back })
    .select("id")
    .single();
  if (error || !card) return { ok: false, error: "Не удалось добавить карточку. Попробуй ещё раз." };

  const { data: settings } = await supabase
    .from("srs_settings")
    .select("starting_ease")
    .eq("owner_id", user.id)
    .maybeSingle();

  await supabase
    .from("srs_state")
    .insert({ flashcard_id: card.id, ease_factor: settings?.starting_ease ?? 2.5 });

  revalidatePath("/brain");
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
  if (!user) throw new Error("Не авторизован.");

  const endedAt = new Date();
  const startedAt = new Date(endedAt.getTime() - input.minutes * 60_000);

  const { error } = await supabase.from("reading_sessions").insert({
    owner_id: user.id,
    text_id: input.textId,
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    words_looked_up: input.wordsLookedUp,
  });
  if (error) throw new Error("Не удалось сохранить сессию чтения.");

  await touchStreak(supabase, user.id);
  revalidatePath("/progress");
}

export async function updateTextProgress(input: {
  textId: string;
  pageIndex: number;
  pageCount: number;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован.");

  const percentRead = Math.round(((input.pageIndex + 1) / input.pageCount) * 100);

  const { error } = await supabase.from("text_progress").upsert(
    {
      owner_id: user.id,
      text_id: input.textId,
      last_page_index: input.pageIndex,
      percent_read: percentRead,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,text_id" },
  );
  if (error) throw new Error("Не удалось сохранить прогресс чтения.");

  revalidatePath("/library");
}
