"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { hasFreeDeckRoom } from "@/lib/subscription";
import { findOrCreateFlashcard } from "@/lib/vocabulary/save";

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
  // M3 Slice 4 §16: createDeck завершается через redirect(), так что клиент
  // (new-deck-modal.tsx) никогда не видит успешный useActionState — ?created
  // это единственный надёжный сигнал для deck_create_succeeded на целевой
  // странице (see [deckId]/deck-analytics.tsx).
  redirect(`/brain/${data.id}?created=true`);
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
    .map((c) => ({ front: c.front.trim(), back: c.back.trim(), notes: c.notes?.trim() || null }));
  if (rows.length === 0) return { ok: false, error: "Нет карточек для импорта." };

  // M3 Slice 10 (brief Phase B §7) — routed through the same normalized_key + item_type dedup
  // service every other save path now uses, instead of the CSV-import-specific bulk pre-check
  // this used to run. Behavior preserved from §13/§15: still never blocks the whole import on a
  // duplicate, still reports a skipped count — via the shared service instead of a parallel
  // implementation of the same idea.
  let createdCount = 0;
  let skippedDuplicates = 0;
  let paywallHit = false;
  for (const row of rows) {
    const result = await findOrCreateFlashcard(supabase, {
      ownerId: profile.id,
      language: deck.language,
      front: row.front,
      back: row.back,
      sourceType: "import_bulk",
      deckId,
      notes: row.notes,
    });
    if (!result.ok) {
      if (result.paywall) paywallHit = true;
      continue;
    }
    if (result.created) createdCount++;
    else skippedDuplicates++;
  }

  if (createdCount === 0) {
    if (paywallHit) return { ok: false, paywall: true, skippedDuplicates };
    return { ok: false, error: "Все карточки уже есть в словаре.", skippedDuplicates };
  }

  revalidatePath(`/brain/${deckId}`);
  revalidatePath("/brain");
  revalidatePath("/brain/vocabulary");
  return { ok: true, count: createdCount, skippedDuplicates };
}
