"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { hasFreeFlashcardRoom } from "@/lib/subscription";

export interface AddCardState {
  error?: string;
  paywall?: boolean;
}

export async function addFlashcard(
  deckId: string,
  _prevState: AddCardState,
  formData: FormData,
): Promise<AddCardState> {
  const front = String(formData.get("front") ?? "").trim();
  const back = String(formData.get("back") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!front || !back) return { error: "Заполни обе стороны карточки." };

  const profile = await requireProfile();
  const supabase = await createClient();

  if (!(await hasFreeFlashcardRoom(supabase, profile.id))) {
    return { paywall: true };
  }

  const { data: card, error } = await supabase
    .from("flashcards")
    .insert({ deck_id: deckId, owner_id: profile.id, front, back, notes: notes || null })
    .select("id")
    .single();
  if (error || !card) return { error: error?.message ?? "Не удалось добавить карточку." };

  const { data: settings } = await supabase
    .from("srs_settings")
    .select("starting_ease")
    .eq("owner_id", profile.id)
    .maybeSingle();

  await supabase
    .from("srs_state")
    .insert({ flashcard_id: card.id, ease_factor: settings?.starting_ease ?? 2.5 });

  revalidatePath(`/brain/${deckId}`);
  return {};
}

export async function deleteFlashcard(deckId: string, cardId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("flashcards").delete().eq("id", cardId);
  if (error) throw new Error(error.message);
  revalidatePath(`/brain/${deckId}`);
}
