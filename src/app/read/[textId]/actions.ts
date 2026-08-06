"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { touchStreak } from "@/lib/streak";
import { statusFromLevel, KNOWN_LEVEL } from "@/lib/word-level";
import { saveVocabularyItem, escapeIlike, type UpsertWordResult } from "@/lib/vocabulary";
import { hasFreeFlashcardRoom, hasFreeDeckRoom } from "@/lib/subscription";
import { addXp } from "@/lib/xp-actions";
import { recordEvidence } from "@/lib/language-twin/evidence";
import type { ReaderPrefs } from "./reader-prefs";

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
  if (result.ok) {
    revalidatePath("/notebook");
    revalidatePath("/brain");
  }
  return result;
}

export async function setWordLevel(vocabularyItemId: string, level: 0 | 1 | 2 | 3 | 4) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("vocabulary_items")
    .update({ level, status: statusFromLevel(level) })
    .eq("id", vocabularyItemId);
  if (error) throw new Error("Не удалось сохранить уровень слова.");

  if (level === KNOWN_LEVEL) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await recordEvidence(supabase, {
        userId: user.id,
        evidenceType: "marked_known",
        sourceType: "vocabulary_item",
        sourceId: vocabularyItemId,
        result: "known",
        confidence: "medium",
      });
    }
  }
  revalidatePath("/notebook");
}

export interface AddPhraseResult {
  ok: boolean;
  paywall?: boolean;
  error?: string;
}

export async function addPhraseToDefaultDeck(input: {
  textId: string;
  front: string;
  back: string;
  contextSentence: string | null;
  contextTranslation: string | null;
}): Promise<AddPhraseResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Не авторизован." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("target_language")
    .eq("id", user.id)
    .single();
  if (!profile) return { ok: false, error: "Профиль не найден." };

  // M3 Slice 3: раньше повторный выбор той же фразы создавал новую карточку
  // каждый раз — здесь дедуп по тому же принципу, что и у слов в
  // saveVocabularyItem() (owner_id + language + front без учёта регистра).
  const { data: existingCard } = await supabase
    .from("flashcards")
    .select("id")
    .eq("owner_id", user.id)
    .eq("language", profile.target_language)
    .ilike("front", escapeIlike(input.front))
    .maybeSingle();
  if (existingCard) {
    return { ok: true };
  }

  if (!(await hasFreeFlashcardRoom(supabase, user.id))) {
    return { ok: false, paywall: true };
  }

  // Найдено при повторном аудите: у колод появилась колонка language (см.
  // миграцию 0018) — "главная" колода теперь одна на язык. Если пользователь
  // переключил target_language и ещё не открывал Мозг для нового языка, для
  // него ещё нет главной колоды — создаём её здесь же, а не показываем ошибку.
  let { data: deck } = await supabase
    .from("decks")
    .select("id")
    .eq("owner_id", user.id)
    .eq("is_default", true)
    .eq("language", profile.target_language)
    .maybeSingle();

  if (!deck) {
    if (!(await hasFreeDeckRoom(supabase, user.id))) {
      return { ok: false, paywall: true };
    }
    const { data: createdDeck, error: createError } = await supabase
      .from("decks")
      .insert({
        owner_id: user.id,
        name: "Основная колода",
        is_default: true,
        language: profile.target_language,
      })
      .select("id")
      .single();
    if (createError || !createdDeck) {
      return { ok: false, error: "Не удалось создать основную колоду." };
    }
    deck = createdDeck;
  }

  const { data: card, error } = await supabase
    .from("flashcards")
    .insert({
      deck_id: deck.id,
      owner_id: user.id,
      front: input.front,
      back: input.back,
      language: profile.target_language,
      context_sentence: input.contextSentence,
      context_translation: input.contextTranslation,
      source_text_id: input.textId,
    })
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

  await recordEvidence(supabase, {
    userId: user.id,
    evidenceType: "phrase_saved",
    sourceType: "flashcard",
    sourceId: card.id,
    result: "new_phrase",
    confidence: "low",
  });

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
  await addXp(supabase, user.id, 10);
  revalidatePath("/progress");
}

// M3 Slice 3 §8: profiles.reader_settings — account-synced on top of the
// localStorage cache (see adoptServerReaderPrefs in reader-settings.tsx).
// Fire-and-forget from the client: a failed sync just means the next
// device sees stale prefs, never blocks reading or loses local settings.
export async function updateReaderSettings(prefs: ReaderPrefs) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("profiles").update({ reader_settings: prefs }).eq("id", user.id);
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

  // Найдено при повторном аудите: гонка при чтении в двух вкладках — старая
  // вкладка (или зависший таймер автосохранения) могла прислать более ранний
  // pageIndex уже после того, как другая вкладка продвинулась дальше, и
  // молча откатить сохранённый прогресс назад. Не регрессируем: пишем,
  // только если новый индекс не меньше уже сохранённого.
  const { data: existing } = await supabase
    .from("text_progress")
    .select("last_page_index")
    .eq("owner_id", user.id)
    .eq("text_id", input.textId)
    .maybeSingle();
  if (existing && input.pageIndex < existing.last_page_index) {
    return;
  }

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
