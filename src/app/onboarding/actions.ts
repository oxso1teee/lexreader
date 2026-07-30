"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isAuthAttemptAllowed, logAuthAttempt } from "@/lib/auth-rate-limit";
import { log } from "@/lib/log";

export interface OnboardingState {
  error?: string;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

export async function completeOnboarding(
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const targetLanguage = String(formData.get("targetLanguage") ?? "");
  const nativeLanguage = String(formData.get("nativeLanguage") ?? "");
  const level = String(formData.get("level") ?? "");
  const dailyWordGoal = Number(formData.get("dailyWordGoal") ?? 10);

  if (!email || !password || !targetLanguage || !nativeLanguage) {
    return { error: "Заполни все обязательные поля." };
  }
  if (targetLanguage === nativeLanguage) {
    return { error: "Изучаемый и родной язык должны отличаться." };
  }

  // P0-АУДИТ 3.8: регистрация раньше не имела рейт-лимита вообще (в отличие
  // от входа/сброса пароля) — можно было скриптовать массовую регистрацию.
  const ip = await clientIp();
  if (!(await isAuthAttemptAllowed([email, ip]))) {
    return { error: "Слишком много попыток — попробуй позже." };
  }

  const supabase = await createClient();

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    await logAuthAttempt([email, ip]);
    // Не показываем сырое сообщение Supabase — оно может как палить
    // существование аккаунта, так и просто быть непонятным на английском.
    return {
      error:
        "Не удалось создать аккаунт. Проверь email и пароль (минимум 6 символов) — если аккаунт уже есть, попробуй войти.",
    };
  }
  if (!signUpData.user) {
    return { error: "Не удалось создать аккаунт. Попробуй ещё раз." };
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: signUpData.user.id,
    target_language: targetLanguage,
    native_language: nativeLanguage,
    level: level || null,
    daily_word_goal: dailyWordGoal,
  });

  if (profileError) {
    return { error: "Не удалось создать профиль. Попробуй ещё раз." };
  }

  const { error: deckError } = await supabase
    .from("decks")
    .insert({
      owner_id: signUpData.user.id,
      name: "Основная колода",
      is_default: true,
      language: targetLanguage,
    });
  if (deckError) {
    log.error({ kind: "onboarding_default_deck", message: deckError.message });
  }

  // docs/IMPLEMENTATION_PROMPT_2026-07-28.md, раздел 8: раньше здесь сразу
  // редиректило на пустую Главную — новый профиль сначала проходит короткий
  // управляемый цикл "текст → слово → карточка", чтобы не встретить пустоту
  // с первой секунды.
  redirect("/onboarding/first-win");
}
