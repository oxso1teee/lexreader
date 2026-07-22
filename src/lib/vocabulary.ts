import type { SupabaseServerClient } from "@/lib/supabase/server";
import { getPlan, FREE_DAILY_WORD_LIMIT } from "@/lib/subscription";

export interface UpsertWordResult {
  ok: boolean;
  paywall?: boolean;
  error?: string;
  id?: string;
  level?: number;
  seenCount?: number;
}

function todayStartUtc(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

export async function saveVocabularyItem(
  supabase: SupabaseServerClient,
  userId: string,
  input: {
    textId: string | null;
    headword: string;
    translation: string;
    contextSentence: string | null;
    contextTranslation: string | null;
  },
): Promise<UpsertWordResult> {
  const { data: existing } = await supabase
    .from("vocabulary_items")
    .select("id, level, seen_count")
    .eq("owner_id", userId)
    .ilike("headword", input.headword)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("vocabulary_items")
      .update({ seen_count: existing.seen_count + 1 })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, id: existing.id, level: existing.level, seenCount: existing.seen_count + 1 };
  }

  const plan = await getPlan(supabase, userId);
  if (plan === "free") {
    const { count } = await supabase
      .from("vocabulary_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", userId)
      .gte("created_at", todayStartUtc());
    if ((count ?? 0) >= FREE_DAILY_WORD_LIMIT) {
      return { ok: false, paywall: true };
    }
  }

  const { data: created, error } = await supabase
    .from("vocabulary_items")
    .insert({
      owner_id: userId,
      source_text_id: input.textId,
      headword: input.headword,
      translation: input.translation,
      context_sentence: input.contextSentence,
      context_translation: input.contextTranslation,
    })
    .select("id, level, seen_count")
    .single();
  if (error || !created) return { ok: false, error: error?.message ?? "Не удалось сохранить слово." };

  return { ok: true, id: created.id, level: created.level, seenCount: created.seen_count };
}
