"use server";

import { createClient } from "@/lib/supabase/server";

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

  if (password.length < 6) {
    return { error: "Пароль должен быть не короче 6 символов." };
  }
  if (password !== confirmPassword) {
    return { error: "Пароли не совпадают." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "Не удалось обновить пароль — возможно, ссылка устарела. Запроси новую." };
  }

  return { success: true };
}
