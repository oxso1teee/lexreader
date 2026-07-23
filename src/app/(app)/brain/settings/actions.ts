"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth";

export interface SettingsFormState {
  error?: string;
  saved?: boolean;
}

// P0-АУДИТ 4: без границ и защиты от NaN можно было сохранить отрицательные/
// нулевые дневные лимиты или пустое поле как NaN (упавшее бы сырой ошибкой
// Postgres). Клампим в разумный диапазон вместо отклонения формы целиком.
function clampedNum(formData: FormData, name: string, min: number, max: number, fallback: number): number {
  const raw = Number(formData.get(name));
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, raw));
}

export async function updateSrsSettings(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("srs_settings")
    .update({
      new_cards_per_day: clampedNum(formData, "new_cards_per_day", 0, 500, 20),
      max_reviews_per_day: clampedNum(formData, "max_reviews_per_day", 0, 1000, 100),
      study_direction: String(formData.get("study_direction")),
      starting_ease: clampedNum(formData, "starting_ease", 1.3, 5, 2.5),
      easy_bonus: clampedNum(formData, "easy_bonus", 1, 3, 1.3),
      interval_modifier: clampedNum(formData, "interval_modifier", 0.5, 2, 1),
      max_interval_days: clampedNum(formData, "max_interval_days", 1, 3650, 365),
      graduating_interval_days: clampedNum(formData, "graduating_interval_days", 1, 30, 1),
      easy_interval_days: clampedNum(formData, "easy_interval_days", 1, 60, 4),
      show_timer: formData.get("show_timer") === "on",
      autoplay_audio: formData.get("autoplay_audio") === "on",
    })
    .eq("owner_id", profile.id);

  if (error) return { error: "Не удалось сохранить настройки. Попробуй ещё раз." };

  revalidatePath("/brain/settings");
  return { saved: true };
}
