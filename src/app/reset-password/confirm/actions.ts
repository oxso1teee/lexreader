"use server";

import { createClient } from "@/lib/supabase/server";
import { validatePassword } from "@/lib/auth/password-policy";

export interface SetPasswordState {
  error?: string;
  success?: boolean;
}

export async function setNewPassword(
  _prevState: SetPasswordState,
  formData: FormData,
): Promise<SetPasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  const check = validatePassword(password, confirmPassword);
  if (!check.ok) return { error: check.error };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "Новый пароль должен отличаться от прежнего." };
    if (error.code === "weak_password") return { error: "Этот пароль слишком простой — придумай другой." };
    return { error: "Не удалось обновить пароль — возможно, ссылка устарела. Запроси новую." };
  }

  // Безопасность: если пароль меняют из-за подозрения на взлом, чужие сессии
  // не должны его пережить. «others» оставляет текущую — человек входит
  // автоматически (макет «Сохранить и войти»). Сбой тут не критичен: пароль
  // уже сменён, а ответ пользователю от этого не зависит.
  await supabase.auth.signOut({ scope: "others" });

  return { success: true };
}
