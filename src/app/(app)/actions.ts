"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_HINT_COOKIE } from "@/lib/auth/session-hint";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { updateTimezoneIfChanged } from "@/lib/user-timezone";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Осознанный выход — не «сессия истекла»: стираем подсказку из
  // lib/auth/session-hint.ts, иначе следующий визит показал бы «Войди снова».
  (await cookies()).delete(SESSION_HINT_COOKIE);
  redirect("/onboarding");
}

// Часовой пояс пользователя — от браузера (Intl). Он определяет, когда «меняется
// день» для цели, серии и заданий (src/lib/user-day.ts). Имя проверяется заново на
// сервере; частоту смены (антидребезг: не чаще раза в час) и допустимые имена обеспечивает база; первая установка не ограничена.
// Возвращает true, если значение изменилось; отказ по частоте — штатная ситуация
// (пояс подхватится при одном из следующих визитов), а не ошибка.
export async function syncTimezoneAction(timezone: unknown): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const result = await updateTimezoneIfChanged(supabase, user.id, timezone);
  if (result !== "changed") return false;
  revalidatePath("/home");
  return true;
}
