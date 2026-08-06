import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { LanguageTwinSettings } from "./types";

const ALGORITHM_VERSION = 1;

const DEFAULT_SETTINGS: Omit<LanguageTwinSettings, "user_id"> = {
  enabled: true,
  include_review_history: true,
  include_reading_behavior: true,
  include_writing_exercises: true,
  include_saved_vocabulary: true,
  allow_diagnostic: true,
  algorithm_version: ALGORITHM_VERSION,
};

// Settings are opt-out, not opt-in (plan doc §9) — a row is created with
// everything enabled the first time it's needed, rather than gating the
// whole feature behind an explicit setup step.
export async function getOrCreateSettings(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<LanguageTwinSettings> {
  const { data: existing } = await supabase
    .from("language_twin_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("language_twin_settings")
    .insert({ user_id: userId, ...DEFAULT_SETTINGS })
    .select("*")
    .single();
  if (error || !created) {
    // Insert can lose a race to a concurrent request creating the same row
    // (user_id is the primary key) — re-read rather than surface an error.
    const { data: reread } = await supabase
      .from("language_twin_settings")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (reread) return reread;
    throw new Error("Не удалось получить настройки Language Twin.");
  }
  return created;
}

export async function updateSettings(
  supabase: SupabaseServerClient,
  userId: string,
  patch: Partial<Omit<LanguageTwinSettings, "user_id" | "algorithm_version">>,
): Promise<void> {
  await getOrCreateSettings(supabase, userId);
  const { error } = await supabase
    .from("language_twin_settings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw new Error("Не удалось сохранить настройки Language Twin.");
}
