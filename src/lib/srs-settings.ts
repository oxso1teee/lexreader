import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { SrsSettings } from "@/lib/types";
import { DEFAULT_SRS_PARAMS, type SrsParams } from "@/lib/srs";

export async function getSrsSettings(
  supabase: SupabaseServerClient,
  ownerId: string,
): Promise<SrsSettings> {
  const { data } = await supabase
    .from("srs_settings")
    .select("*")
    .eq("owner_id", ownerId)
    .maybeSingle();

  if (data) return data as SrsSettings;

  const { data: created } = await supabase
    .from("srs_settings")
    .insert({ owner_id: ownerId })
    .select("*")
    .single();

  return (created ?? {
    owner_id: ownerId,
    new_cards_per_day: 20,
    max_reviews_per_day: 200,
    study_direction: "front_back",
    starting_ease: 2.5,
    easy_bonus: 1.3,
    interval_modifier: 1.0,
    max_interval_days: 36500,
    learning_steps_minutes: "1,10",
    relearning_steps_minutes: "10",
    graduating_interval_days: 1,
    easy_interval_days: 4,
    show_timer: true,
    autoplay_audio: false,
  }) as SrsSettings;
}

export async function getSrsParams(
  supabase: SupabaseServerClient,
  ownerId: string,
): Promise<SrsParams> {
  const settings = await getSrsSettings(supabase, ownerId);
  return {
    easyBonus: settings.easy_bonus,
    intervalModifier: settings.interval_modifier,
    maxIntervalDays: settings.max_interval_days,
    graduatingIntervalDays: settings.graduating_interval_days,
    easyIntervalDays: settings.easy_interval_days,
  };
}

export { DEFAULT_SRS_PARAMS };
