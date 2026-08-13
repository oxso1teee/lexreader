"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { KNOWN_LEVEL } from "@/lib/word-level";
import { saveVocabularyItem, type UpsertWordResult } from "@/lib/vocabulary";
import { findOrCreateFlashcard } from "@/lib/vocabulary/save";
import { deriveItemType } from "@/lib/vocabulary/item-type";
import { recordEvidence } from "@/lib/language-twin/evidence";

export async function deleteWord(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("vocabulary_items").delete().eq("id", id);
  if (error) throw new Error("Не удалось удалить слово.");
  revalidatePath("/notebook");
}

export async function markKnown(id: string) {
  const profile = await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("vocabulary_items")
    .update({ status: "known", level: KNOWN_LEVEL })
    .eq("id", id);
  if (error) throw new Error("Не удалось обновить слово.");
  await recordEvidence(supabase, {
    userId: profile.id,
    evidenceType: "marked_known",
    sourceType: "vocabulary_item",
    sourceId: id,
    result: "known",
    confidence: "medium",
  });
  revalidatePath("/notebook");
}

export async function toggleFavorite(id: string, isFavorite: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("vocabulary_items")
    .update({ is_favorite: isFavorite })
    .eq("id", id);
  if (error) throw new Error("Не удалось обновить слово.");
  revalidatePath("/notebook");
}

export async function setPhotoUrl(id: string, photoUrl: string | null) {
  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from("vocabulary_items")
    .update({ photo_url: photoUrl })
    .eq("id", id)
    .select("flashcard_id")
    .single();
  if (error) throw new Error("Не удалось сохранить фото.");
  if (item?.flashcard_id) {
    await supabase.from("flashcards").update({ photo_url: photoUrl }).eq("id", item.flashcard_id);
  }
  revalidatePath("/notebook");
}

export async function addManualWord(input: {
  headword: string;
  translation: string;
  note?: string;
}): Promise<UpsertWordResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Не авторизован." };

  const headword = input.headword.trim();
  const translation = input.translation.trim();
  if (!headword || !translation) {
    return { ok: false, error: "Заполни слово и перевод." };
  }

  // P0-АУДИТ 3.9: слово без текста-источника помечаем текущим изучаемым
  // языком профиля — иначе не смогли бы его потом ни к одному языку отнести.
  const profile = await requireProfile();

  // M3 Slice 10 (brief Phase B §6) — a manually-typed PHRASE never goes through
  // vocabulary_items (same invariant Reader phrase-save already relies on, confirmed sound in
  // the Phase A audit) — it goes straight to the shared flashcard service instead, tagged
  // item_type='phrase', sourceType='manual'. Only a genuine single word uses the
  // vocabulary_items-backed path (Notebook/Language-Twin activation-gap compatibility).
  if (deriveItemType(headword) === "phrase") {
    const result = await findOrCreateFlashcard(supabase, {
      ownerId: user.id,
      language: profile.target_language,
      front: headword,
      back: translation,
      itemType: "phrase",
      sourceType: "manual",
      context: input.note?.trim()
        ? { text: input.note.trim(), translation: null, sourceTextId: null, sourceType: "manual" }
        : null,
    });
    if (!result.ok) return { ok: false, error: result.error, paywall: result.paywall };
    revalidatePath("/notebook");
    revalidatePath("/brain");
    revalidatePath("/brain/vocabulary");
    return { ok: true, id: result.flashcardId, contextAdded: result.contextAdded };
  }

  const result = await saveVocabularyItem(supabase, user.id, {
    textId: null,
    headword,
    translation,
    contextSentence: input.note?.trim() || null,
    contextTranslation: null,
    language: profile.target_language,
  });
  if (result.ok) {
    revalidatePath("/notebook");
    revalidatePath("/brain");
  }
  return result;
}
