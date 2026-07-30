"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";
import { translateText } from "@/lib/translate";
import { saveVocabularyItem } from "@/lib/vocabulary";

export interface FirstWinWordResult {
  ok: boolean;
  translation?: string;
  error?: string;
}

// docs/IMPLEMENTATION_PROMPT_2026-07-28.md, раздел 8.2, шаг B: тот же
// перевод и та же точка сохранения слова, что и в обычной читалке — просто
// без полноценного UI ридера вокруг.
export async function saveFirstWinWord(word: string): Promise<FirstWinWordResult> {
  const profile = await requireProfile();
  const supabase = await createClient();

  let translation: string;
  try {
    translation = await translateText(word, profile.target_language, profile.native_language);
  } catch {
    return { ok: false, error: "Не удалось перевести слово. Попробуй другое." };
  }

  const result = await saveVocabularyItem(supabase, profile.id, {
    textId: null,
    headword: word,
    translation,
    contextSentence: null,
    contextTranslation: null,
    language: profile.target_language,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, translation };
}

export async function completeFirstWin(): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();
  await supabase.from("profiles").update({ completed_first_win: true }).eq("id", profile.id);
}
