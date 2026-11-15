"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isAuthAttemptAllowed, logAuthAttempt } from "@/lib/auth-rate-limit";
import { attemptsLeftAfterFailure, authRateLimitConfig } from "@/lib/auth-rate-limit-config";
import { isPlausibleEmail } from "@/lib/auth/email";
import { safeNextPath } from "@/lib/auth/safe-next";
import type { EmailLinkState } from "@/lib/auth/types";
import { log } from "@/lib/log";
import { pluralRu } from "@/lib/plural-ru";
import { siteUrl } from "@/lib/site-url";

export interface LoginState {
  error?: string;
  retryAfterSeconds?: number;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (!email || !password) {
    return { error: "Заполни email и пароль." };
  }

  const ip = await clientIp();
  const attempt = await isAuthAttemptAllowed("login", [email, ip]);
  if (!attempt.allowed) {
    return { error: "Слишком много попыток входа.", retryAfterSeconds: attempt.retryAfterSeconds };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // В лимит идут только неудачные попытки — иначе обычный пользователь
    // с несколькими вкладками/устройствами рискует сам себя заблокировать.
    await logAuthAttempt("login", [email, ip]);

    // «Осталось N попыток» (макет Login). Счётчик общий для существующих и
    // несуществующих email, так что это не канал для перебора аккаунтов.
    const left = attemptsLeftAfterFailure(authRateLimitConfig().maxAttempts, attempt.attemptsInWindow ?? 0);
    if (left === 0) {
      // Лимит исчерпан именно этой попыткой — сразу показываем блокировку с
      // обратным отсчётом, а не просим сделать ещё одну неудачную попытку.
      const blocked = await isAuthAttemptAllowed("login", [email, ip]);
      if (!blocked.allowed) {
        return { error: "Слишком много попыток входа.", retryAfterSeconds: blocked.retryAfterSeconds };
      }
    }
    const remaining =
      left > 0
        ? ` ${pluralRu(left, "Осталась", "Осталось", "Осталось")} ${left} ${pluralRu(left, "попытка", "попытки", "попыток")}.`
        : "";
    return { error: `Неверный email или пароль.${remaining}` };
  }

  redirect(next ?? "/home");
}

// Вход по ссылке из письма (макеты Login → Magic-link-sent). Ссылка ведёт
// через /auth/callback (обмен кода на сессию, PKCE) и работает только в том
// браузере, где запрошена. Не создаёт новых пользователей: регистрация —
// отдельный путь (completeOnboarding заводит профиль и колоду), иначе ссылка
// породила бы аккаунт без профиля.
export async function requestMagicLink(_prevState: EmailLinkState, formData: FormData): Promise<EmailLinkState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!isPlausibleEmail(email)) {
    return { error: "Введи email — отправим на него ссылку для входа." };
  }
  const next = safeNextPath(formData.get("next"));

  const ip = await clientIp();
  const attempt = await isAuthAttemptAllowed("magic-link", [email, ip]);
  if (!attempt.allowed) {
    return { error: "Слишком много запросов ссылки.", retryAfterSeconds: attempt.retryAfterSeconds };
  }
  await logAuthAttempt("magic-link", [email, ip]);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next ?? "/home")}`,
    },
  });

  if (error) {
    // 429 — общий лимит отправки писем у почтового провайдера: от того,
    // есть ли такой аккаунт, не зависит, поэтому говорим прямо.
    if (error.status === 429) {
      return { error: "Письма сейчас уходят слишком часто — подожди пару минут и попробуй снова." };
    }
    // Сбой на стороне сервера/почты — тоже не про аккаунт.
    if (!error.status || error.status >= 500) {
      log.error({ kind: "magic_link_send", message: error.message });
      return { error: "Не удалось отправить письмо. Попробуй ещё раз через минуту." };
    }
    // Остальные 4xx — в первую очередь «такого пользователя нет» (otp_disabled
    // при shouldCreateUser: false). Отвечаем так же, как при успехе, — иначе
    // по ответу можно проверять, зарегистрирован ли email.
  }

  return { sent: true, email };
}
