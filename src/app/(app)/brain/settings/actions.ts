"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export interface SettingsFormState {
  error?: string;
  saved?: boolean;
}

export async function updateSrsSettings(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const num = (name: string) => Number(formData.get(name));

  const { error } = await supabase
    .from("srs_settings")
    .update({
      new_cards_per_day: num("new_cards_per_day"),
      max_reviews_per_day: num("max_reviews_per_day"),
      study_direction: String(formData.get("study_direction")),
      starting_ease: num("starting_ease"),
      easy_bonus: num("easy_bonus"),
      interval_modifier: num("interval_modifier"),
      max_interval_days: num("max_interval_days"),
      graduating_interval_days: num("graduating_interval_days"),
      easy_interval_days: num("easy_interval_days"),
      show_timer: formData.get("show_timer") === "on",
      autoplay_audio: formData.get("autoplay_audio") === "on",
    })
    .eq("owner_id", profile.id);

  if (error) return { error: error.message };

  revalidatePath("/brain/settings");
  return { saved: true };
}
