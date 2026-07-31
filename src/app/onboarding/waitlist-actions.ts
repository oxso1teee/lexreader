"use server";

import { createClient } from "@/lib/supabase/server";

export interface WaitlistState {
  ok?: boolean;
  error?: string;
}

// Раздел 5 промта 2026-07-30 (запуск): язык без готового контента — лист
// ожидания вместо честного, но пустого выбора. Insert-only, RLS открыт для
// anon/authenticated (см. supabase/migrations/0029_language_waitlist.sql).
export async function joinLanguageWaitlist(
  _prevState: WaitlistState,
  formData: FormData,
): Promise<WaitlistState> {
  const email = String(formData.get("email") ?? "").trim();
  const language = String(formData.get("language") ?? "").trim();

  if (!email || !language) {
    return { error: "Заполни email." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("language_waitlist").insert({ email, language });

  // unique(email, language) — повторная запись того же email на тот же
  // язык не ошибка с точки зрения пользователя, просто "уже в списке".
  if (error && !error.message.includes("duplicate")) {
    return { error: "Не удалось сохранить — попробуй ещё раз." };
  }
  return { ok: true };
}
