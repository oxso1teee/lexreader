"use server";

import { createClient } from "@/lib/supabase/server";
import { isAuthAttemptAllowed, logAuthAttempt } from "@/lib/auth-rate-limit";
import { siteUrl } from "@/lib/site-url";

export interface ResetRequestState {
  submitted?: boolean;
  error?: string;
}

export async function requestPasswordReset(
  _prevState: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Введи email." };

  if (!(await isAuthAttemptAllowed([email]))) {
    return { error: "Слишком много запросов — попробуй позже." };
  }
  await logAuthAttempt([email]);

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl()}/auth/callback?next=/reset-password/confirm`,
  });

  // Один и тот же ответ независимо от того, существует ли такой email —
  // не даём проверять существование аккаунтов перебором.
  return { submitted: true };
}
