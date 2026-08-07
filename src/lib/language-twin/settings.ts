import type { SupabaseServerClient } from "@/lib/supabase/server";
import { log } from "../log.ts";
import type { LanguageTwinSettings } from "./types";

// Same incident shape as fsrs.ts's isMissingFsrsColumnsError (2026-08-01:
// code deployed before its migration). Confirmed empirically (2026-08-06,
// reproduced locally by dropping the six language_twin_*/language_error_*
// tables and hitting /home): supabase-js talking to PostgREST returns
// PGRST205 ("Could not find the table ... in the schema cache"), not the
// raw Postgres 42P01 SQLSTATE a direct psql query would give — PostgREST
// caches the schema and reports its own not-found code for an unknown
// relation. Checking both covers a future direct-Postgres code path too.
// Language Twin's migration 0036 is additive and applied locally only so
// far; Preview/Production share one Supabase project (see Vercel env
// config) and don't have it, so every language_twin_* query there hits
// this until the migration is applied.
export function isMissingRelationError(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

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
  const { data: existing, error: selectError } = await supabase
    .from("language_twin_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return existing;
  if (isMissingRelationError(selectError)) {
    log.error({
      kind: "language_twin_schema_missing",
      message: `${selectError?.code}: ${selectError?.message}`,
    });
    throw new Error("Language Twin storage is unavailable.");
  }

  const { data: created, error } = await supabase
    .from("language_twin_settings")
    .insert({ user_id: userId, ...DEFAULT_SETTINGS })
    .select("*")
    .single();
  if (error || !created) {
    // Insert can lose a race to a concurrent request creating the same row
    // (user_id is the primary key) — re-read rather than surface an error.
    const { data: reread, error: rereadError } = await supabase
      .from("language_twin_settings")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (reread) return reread;
    const finalError = rereadError ?? error;
    log.error({
      kind: "language_twin_settings_unavailable",
      message: `${finalError?.code ?? "unknown"}: ${finalError?.message ?? "no data returned"}`,
    });
    throw new Error("Не удалось получить настройки Language Twin.");
  }
  return created;
}

// For call sites where Language Twin is a secondary/optional enhancement
// (Today/Progress summary cards, the dedicated Overview/Settings pages) —
// never let a Language Twin storage problem take down surrounding content
// that has nothing to do with this feature. The real error is already
// logged inside getOrCreateSettings above; callers just get null back and
// treat it exactly like "feature unavailable right now."
export async function getOrCreateSettingsSafe(
  supabase: SupabaseServerClient,
  userId: string,
): Promise<LanguageTwinSettings | null> {
  try {
    return await getOrCreateSettings(supabase, userId);
  } catch {
    return null;
  }
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
