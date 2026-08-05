"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { hasFreeDeckRoom, hasFreeFlashcardRoom } from "@/lib/subscription";

export interface DeckFormState {
  error?: string;
  paywall?: boolean;
}

export async function createDeck(
  _prevState: DeckFormState,
  formData: FormData,
): Promise<DeckFormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Введи название колоды." };

  const profile = await requireProfile();
  const supabase = await createClient();

  if (!(await hasFreeDeckRoom(supabase, profile.id))) {
    return { paywall: true };
  }

  const { data, error } = await supabase
    .from("decks")
    .insert({ owner_id: profile.id, name, language: profile.target_language })
    .select("id")
    .single();
  if (error || !data) return { error: "Не удалось создать колоду. Попробуй ещё раз." };

  revalidatePath("/brain");
  redirect(`/brain/${data.id}`);
}

export async function deleteDeck(deckId: string) {
  const supabase = await createClient();

  // Найдено при живой проверке: удаление главной колоды (is_default=true)
  // ломает addPhraseToDefaultDeck (read/[textId]/actions.ts) — она ищет
  // колоду с is_default=true, и без неё "добавить слово из читалки в
  // карточку" перестаёт работать насовсем (в UI нет способа назначить
  // другую колоду главной). Проверка в UI (deck-card.tsx) уже не даёт
  // нажать кнопку, но дублируем на сервере на случай прямого вызова.
  //
  // M3 Slice 4 §11: найдено при аудите — is_starter=true колоды не были
  // защищены вообще, ни здесь, ни в UI (deck-card.tsx получал только
  // isDefault, не isStarter). Стартовые колоды — общий бесплатный ресурс
  // (не расходуют лимит тарифа, hasFreeDeckRoom их не считает), удалять их
  // так же нежелательно, как и главную.
  const { data: deck } = await supabase
    .from("decks")
    .select("is_default, is_starter")
    .eq("id", deckId)
    .maybeSingle();
  if (deck?.is_default) {
    throw new Error("Нельзя удалить главную колоду.");
  }
  if (deck?.is_starter) {
    throw new Error("Нельзя удалить стартовую колоду.");
  }

  const { error } = await supabase.from("decks").delete().eq("id", deckId);
  if (error) throw new Error("Не удалось удалить колоду.");
  revalidatePath("/brain");
  revalidatePath("/brain/vocabulary");
}

// M3 Slice 4 §11: name уже была mutable-колонкой без schema — просто не было
// server action, который бы её менял. description остаётся отложенным
// (колонки нет ни в одной миграции), rename её не блокирует.
export async function renameDeck(deckId: string, name: string): Promise<{ ok: boolean; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Название не может быть пустым." };

  const supabase = await createClient();
  const { error } = await supabase.from("decks").update({ name: trimmed }).eq("id", deckId);
  if (error) return { ok: false, error: "Не удалось переименовать колоду." };

  revalidatePath("/brain");
  revalidatePath("/brain/vocabulary");
  revalidatePath(`/brain/${deckId}`);
  return { ok: true };
}

interface ImportCard {
  front: string;
  back: string;
  notes?: string;
}

export async function importFlashcards(deckId: string, cards: ImportCard[]) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: deck } = await supabase
    .from("decks")
    .select("id, language")
    .eq("id", deckId)
    .eq("owner_id", profile.id)
    .maybeSingle();
  if (!deck) return { ok: false, error: "Колода не найдена." };

  const rows = cards
    .filter((c) => c.front.trim() && c.back.trim())
    .map((c) => ({
      deck_id: deckId,
      owner_id: profile.id,
      front: c.front.trim(),
      back: c.back.trim(),
      notes: c.notes?.trim() || null,
      language: deck.language,
    }));
  if (rows.length === 0) return { ok: false, error: "Нет карточек для импорта." };

  if (!(await hasFreeFlashcardRoom(supabase, profile.id, rows.length))) {
    return { ok: false, paywall: true };
  }

  const { data: inserted, error } = await supabase.from("flashcards").insert(rows).select("id");
  if (error) return { ok: false, error: "Не удалось импортировать карточки. Попробуй ещё раз." };

  const settings = await supabase
    .from("srs_settings")
    .select("starting_ease")
    .eq("owner_id", profile.id)
    .maybeSingle();
  const startingEase = settings.data?.starting_ease ?? 2.5;

  await supabase.from("srs_state").insert(
    (inserted ?? []).map((c) => ({ flashcard_id: c.id, ease_factor: startingEase })),
  );

  revalidatePath(`/brain/${deckId}`);
  revalidatePath("/brain");
  return { ok: true, count: rows.length };
}
