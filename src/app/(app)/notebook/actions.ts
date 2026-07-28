"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { KNOWN_LEVEL } from "@/lib/word-level";
import { saveVocabularyItem, type UpsertWordResult } from "@/lib/vocabulary";

export async function deleteWord(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("vocabulary_items").delete().eq("id", id);
  if (error) throw new Error("Не удалось удалить слово.");
  revalidatePath("/notebook");
}

export async function markKnown(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("vocabulary_items")
    .update({ status: "known", level: KNOWN_LEVEL })
    .eq("id", id);
  if (error) throw new Error("Не удалось обновить слово.");
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
  const { error } = await supabase
    .from("vocabulary_items")
    .update({ photo_url: photoUrl })
    .eq("id", id);
  if (error) throw new Error("Не удалось сохранить фото.");
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

  const result = await saveVocabularyItem(supabase, user.id, {
    textId: null,
    headword,
    translation,
    contextSentence: input.note?.trim() || null,
    contextTranslation: null,
    language: profile.target_language,
  });
  if (result.ok) revalidatePath("/notebook");
  return result;
}
