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
    .insert({ owner_id: profile.id, name })
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
  const { data: deck } = await supabase
    .from("decks")
    .select("is_default")
    .eq("id", deckId)
    .maybeSingle();
  if (deck?.is_default) {
    throw new Error("Нельзя удалить главную колоду.");
  }

  const { error } = await supabase.from("decks").delete().eq("id", deckId);
  if (error) throw new Error("Не удалось удалить колоду.");
  revalidatePath("/brain");
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
    .select("id")
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
