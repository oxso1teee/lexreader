"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_HINT_COOKIE } from "@/lib/auth/session-hint";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Осознанный выход — не «сессия истекла»: стираем подсказку из
  // lib/auth/session-hint.ts, иначе следующий визит показал бы «Войди снова».
  (await cookies()).delete(SESSION_HINT_COOKIE);
  redirect("/onboarding");
}
