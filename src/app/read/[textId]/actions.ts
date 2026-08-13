"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { touchStreak } from "@/lib/streak";
import { statusFromLevel, KNOWN_LEVEL } from "@/lib/word-level";
import { saveVocabularyItem, type UpsertWordResult } from "@/lib/vocabulary";
import { findOrCreateFlashcard } from "@/lib/vocabulary/save";
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
  /** M3 Slice 10 — true when this phrase was already saved before this call (Reader shows
   *  "Уже изучается" instead of a fresh "saved" confirmation). */
  alreadyExisted?: boolean;
  /** true when a genuinely new context occurrence was recorded (new or existing phrase). */
  contextAdded?: boolean;
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

  // M3 Slice 10 (brief Phase B §4/§5) — routed through the shared dedup service
  // (normalized_key + owner + language + item_type='phrase') instead of a standalone ilike
  // check: an existing phrase is now reused and gets this occurrence appended as a new
  // context (deduped against identical text) rather than silently no-op'd.
  const result = await findOrCreateFlashcard(supabase, {
    ownerId: user.id,
    language: profile.target_language,
    front: input.front,
    back: input.back,
    itemType: "phrase",
    sourceType: "reader",
    context: input.contextSentence
      ? {
          text: input.contextSentence,
          translation: input.contextTranslation,
          sourceTextId: input.textId,
          sourceType: "reader",
        }
      : null,
  });
  if (!result.ok) {
    return { ok: false, paywall: result.paywall, error: result.error };
  }

  if (result.created) {
    await recordEvidence(supabase, {
      userId: user.id,
      evidenceType: "phrase_saved",
      sourceType: "flashcard",
      sourceId: result.flashcardId!,
      result: "new_phrase",
      confidence: "low",
    });
  }

  revalidatePath("/brain");
  revalidatePath("/brain/vocabulary");
  return { ok: true, alreadyExisted: !result.created, contextAdded: result.contextAdded };
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
