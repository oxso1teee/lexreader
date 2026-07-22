"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isAuthAttemptAllowed, logAuthAttempt } from "@/lib/auth-rate-limit";

export interface LoginState {
  error?: string;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

export async function login(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Заполни email и пароль." };
  }

  const ip = await clientIp();
  if (!(await isAuthAttemptAllowed([email, ip]))) {
    return { error: "Слишком много попыток входа — попробуй позже." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // В лимит идут только неудачные попытки — иначе обычный пользователь
    // с несколькими вкладками/устройствами рискует сам себя заблокировать.
    await logAuthAttempt([email, ip]);
    return { error: "Неверный email или пароль." };
  }

  redirect("/home");
}
