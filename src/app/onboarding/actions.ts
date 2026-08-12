"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import type { AuthError } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAuthAttemptAllowed, logAuthAttempt } from "@/lib/auth-rate-limit";
import { log } from "@/lib/log";

export interface OnboardingState {
  error?: string;
  retryAfterSeconds?: number;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

// M3 Slice 9 — profile-creation orphan fix (plan doc §9). Before this
// fix, a signUp() that succeeded followed by a failed profiles insert left
// a real auth.users row with no way to ever finish onboarding: retrying
// the form re-ran signUp() with the same email, which always fails
// "already registered" (no code path recovered from that). Checks both
// the newer AuthError.code and a message-substring fallback, since a
// locally-run Supabase CLI version may not populate .code consistently.
function isAlreadyRegisteredError(error: AuthError): boolean {
  if (error.code === "user_already_exists" || error.code === "email_exists") return true;
  return /already registered|already exists/i.test(error.message);
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
  // M3 Slice 9: both optional at the form level — the goal/self-report
  // screens are Phase B UI; this action is made ready for them now so
  // Phase B only has to add form fields, not touch this action again.
  const primaryGoal = String(formData.get("primaryGoal") ?? "") || null;
  const selfReportedCefr = String(formData.get("selfReportedCefr") ?? "") || null;

  if (!email || !password || !targetLanguage || !nativeLanguage) {
    return { error: "Заполни все обязательные поля." };
  }
  if (targetLanguage === nativeLanguage) {
    return { error: "Изучаемый и родной язык должны отличаться." };
  }

  // P0-АУДИТ 3.8: регистрация раньше не имела рейт-лимита вообще (в отличие
  // от входа/сброса пароля) — можно было скриптовать массовую регистрацию.
  const ip = await clientIp();
  const attempt = await isAuthAttemptAllowed("signup", [email, ip]);
  if (!attempt.allowed) {
    return { error: "Слишком много попыток регистрации.", retryAfterSeconds: attempt.retryAfterSeconds };
  }

  const supabase = await createClient();

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  let userId: string;
  if (signUpError) {
    // M3 Slice 9 (plan doc §9): "already registered" here means either a
    // real duplicate signup attempt, OR a prior attempt that created the
    // auth user but failed before/at the profile insert below — the exact
    // orphan case. Falling back to a real login (same credentials, already
    // in hand) recovers the second case without a dead end, and is
    // harmless for the first case (wrong password there just surfaces the
    // same generic error a normal login would).
    if (!isAlreadyRegisteredError(signUpError)) {
      await logAuthAttempt("signup", [email, ip]);
      return {
        error:
          "Не удалось создать аккаунт. Проверь email и пароль (минимум 6 символов) — если аккаунт уже есть, попробуй войти.",
      };
    }
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError || !loginData.user) {
      await logAuthAttempt("signup", [email, ip]);
      return {
        error: "Аккаунт с таким email уже существует. Попробуй войти или используй другой email.",
      };
    }
    userId = loginData.user.id;
  } else {
    if (!signUpData.user) {
      return { error: "Не удалось создать аккаунт. Попробуй ещё раз." };
    }
    userId = signUpData.user.id;
  }

  // Idempotent — safe to retry after a partial failure on a previous
  // attempt (same orphan-recovery reasoning as above). onConflict: "id"
  // means a retry re-applies the same intended values rather than erroring
  // on a duplicate key.
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      target_language: targetLanguage,
      native_language: nativeLanguage,
      level: level || null,
      daily_word_goal: dailyWordGoal,
      primary_goal: primaryGoal,
      self_reported_cefr: selfReportedCefr,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    return { error: "Не удалось создать профиль. Попробуй ещё раз." };
  }

  // Guard against a duplicate default deck on retry — the insert itself
  // isn't idempotent, so check first (plan doc §9).
  const { data: existingDefaultDeck } = await supabase
    .from("decks")
    .select("id")
    .eq("owner_id", userId)
    .eq("is_default", true)
    .maybeSingle();

  if (!existingDefaultDeck) {
    const { error: deckError } = await supabase
      .from("decks")
      .insert({
        owner_id: userId,
        name: "Основная колода",
        is_default: true,
        language: targetLanguage,
      });
    if (deckError) {
      log.error({ kind: "onboarding_default_deck", message: deckError.message });
    }
  }

  // M3 Slice 9 (plan doc §3/§16): profile creation now hands off to the
  // Placement v2 flow — goal + self-reported level, both already saved
  // above, feed straight into it. Replaces the old "read a text, save 3
  // words" first-win tutorial (docs/IMPLEMENTATION_PROMPT_2026-07-28.md
  // §8), which is removed — the real first Learning Paths Skill + Knowledge
  // Check (reached after placement -> result -> path selection) is now the
  // guided first action.
  redirect("/onboarding/placement");
}
