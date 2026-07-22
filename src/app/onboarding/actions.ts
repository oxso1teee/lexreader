"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface OnboardingState {
  error?: string;
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

  const supabase = await createClient();

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    return { error: signUpError.message };
  }
  if (!signUpData.user) {
    return { error: "Не удалось создать аккаунт." };
  }

  const { error: profileError } = await supabase.from("profiles").insert({
    id: signUpData.user.id,
    target_language: targetLanguage,
    native_language: nativeLanguage,
    level: level || null,
    daily_word_goal: dailyWordGoal,
  });

  if (profileError) {
    return { error: profileError.message };
  }

  redirect("/home");
}
