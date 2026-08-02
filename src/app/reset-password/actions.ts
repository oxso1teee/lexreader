"use server";

import { createClient } from "@/lib/supabase/server";
import { isAuthAttemptAllowed, logAuthAttempt } from "@/lib/auth-rate-limit";
import { siteUrl } from "@/lib/site-url";

export interface ResetRequestState {
  submitted?: boolean;
  error?: string;
  retryAfterSeconds?: number;
}

export async function requestPasswordReset(
  _prevState: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Введи email." };

  const attempt = await isAuthAttemptAllowed("reset-password", [email]);
  if (!attempt.allowed) {
    return { error: "Слишком много запросов на сброс пароля.", retryAfterSeconds: attempt.retryAfterSeconds };
  }
  await logAuthAttempt("reset-password", [email]);

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/reset-password/confirm`,
  });

  // Один и тот же ответ независимо от того, существует ли такой email —
  // не даём проверять существование аккаунтов перебором.
  return { submitted: true };
}
