import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/auth/safe-next";
import { SESSION_HINT_COOKIE } from "@/lib/auth/session-hint";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// Один запрос getUser() на оба случая: requireProfile должен отличать «нет
// сессии» от «сессия есть, профиля нет» (прерванная регистрация), а дважды
// ходить в GoTrue на каждой странице незачем.
async function getAuthState(): Promise<{ hasUser: boolean; profile: Profile | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { hasUser: false, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return { hasUser: true, profile };
}

export async function getProfile(): Promise<Profile | null> {
  return (await getAuthState()).profile;
}

// Куда отправить анонимного посетителя защищённой страницы. Впервые пришёл —
// в онбординг, как и раньше. Уже входил на этом устройстве (кука-подсказка,
// см. lib/auth/session-hint.ts), значит сессия закончилась — на «Войди снова»
// с возвратом на ту же страницу (x-pathname выставляет proxy.ts).
async function signedOutTarget(): Promise<string> {
  if (!(await cookies()).has(SESSION_HINT_COOKIE)) return "/onboarding";
  const params = new URLSearchParams({ reason: "expired" });
  const next = safeNextPath((await headers()).get("x-pathname"));
  if (next) params.set("next", next);
  return `/login?${params.toString()}`;
}

export async function requireProfile(): Promise<Profile> {
  const { hasUser, profile } = await getAuthState();
  if (!profile) {
    // Сессия есть, профиля нет — онбординг это чинит; сессии нет — см. выше.
    redirect(hasUser ? "/onboarding" : await signedOutTarget());
  }
  return profile;
}
