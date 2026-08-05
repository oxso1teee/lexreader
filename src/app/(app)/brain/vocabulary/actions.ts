"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { KNOWN_LEVEL } from "@/lib/word-level";

export interface BulkResult {
  ok: boolean;
  error?: string;
  count?: number;
}

// M3 Slice 4 §9: массовые действия над Vocabulary. Ownership не проверяется
// вручную построчно — RLS-политики "flashcards: owner full access" и
// "vocabulary_items: owner full access" (миграции 0001/0004) уже гарантируют,
// что .in("id", ids) физически не сможет задеть чужие строки, тем же
// способом, каким это уже работает для одиночных deleteFlashcard/deleteWord.

export async function bulkMoveToDeck(flashcardIds: string[], targetDeckId: string): Promise<BulkResult> {
  if (flashcardIds.length === 0) return { ok: false, error: "Ничего не выбрано." };
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: targetDeck } = await supabase
    .from("decks")
    .select("id")
    .eq("id", targetDeckId)
    .eq("owner_id", profile.id)
    .maybeSingle();
  if (!targetDeck) return { ok: false, error: "Колода не найдена." };

  const { error, count } = await supabase
    .from("flashcards")
    .update({ deck_id: targetDeckId }, { count: "exact" })
    .in("id", flashcardIds);
  if (error) return { ok: false, error: "Не удалось переместить карточки." };

  revalidatePath("/brain/vocabulary");
  revalidatePath("/brain");
  return { ok: true, count: count ?? flashcardIds.length };
}

// Ограничение осознанное: "уже знаю" в этом виде затрагивает только
// vocabulary_items.status (знание слова из чтения) — то же самое поле и та
// же семантика, что и notebook/actions.ts:markKnown, никогда не трогает
// FSRS/srs_state напрямую. Карточки без vocabulary_item (добавлены вручную/
// импортом в Мозг, не через чтение) у этого действия просто нет — вызывающий
// UI обязан отфильтровать такие id до вызова (иначе они безопасно
// игнорируются: .in() на пустое множество ничего не находит).
export async function bulkMarkKnown(vocabularyItemIds: string[]): Promise<BulkResult> {
  if (vocabularyItemIds.length === 0) return { ok: false, error: "Ничего не выбрано." };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("vocabulary_items")
    .update({ status: "known", level: KNOWN_LEVEL }, { count: "exact" })
    .in("id", vocabularyItemIds);
  if (error) return { ok: false, error: "Не удалось обновить слова." };

  revalidatePath("/brain/vocabulary");
  revalidatePath("/notebook");
  return { ok: true, count: count ?? vocabularyItemIds.length };
}

// Удаляет только flashcards — связанный vocabulary_item (если есть) не
// трогаем: FK vocabulary_items.flashcard_id -> flashcards(id) уже стоит
// "on delete set null" (migration 0028), то есть слово останется видно в
// Тетради, просто перестанет участвовать в интервальном повторении. Это
// поведение уже встроено в схему, а не решение, принятое здесь — стирать
// слово из Тетради целиком было бы более разрушительным действием, чем
// просит кнопка "Удалить" в контексте карточек.
export async function bulkDeleteFlashcards(flashcardIds: string[]): Promise<BulkResult> {
  if (flashcardIds.length === 0) return { ok: false, error: "Ничего не выбрано." };
  const supabase = await createClient();
  const { error, count } = await supabase
    .from("flashcards")
    .delete({ count: "exact" })
    .in("id", flashcardIds);
  if (error) return { ok: false, error: "Не удалось удалить карточки." };

  revalidatePath("/brain/vocabulary");
  revalidatePath("/brain");
  return { ok: true, count: count ?? flashcardIds.length };
}
