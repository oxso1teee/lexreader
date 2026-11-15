"use server";

import { createClient } from "@/lib/supabase/server";
import type { RateAppMoment } from "@/lib/moments/types";

const COOLDOWN_DAYS = 120;

// docs/moments/ROADMAP.md, этап 7 — Rate-app. Вызывается из MomentProvider
// на клиенте только когда уже показан позитивный момент и платформа
// нативная (см. moment-provider.tsx) — здесь только сторож "не чаще раза в
// 120 дней", без requireProfile() (тот же приём, что у weekly-rank-actions,
// чтобы не ловить редирект, если гейт вдруг смонтирован без сессии).
export async function maybeRateAppMoment(): Promise<RateAppMoment | null> {
  const supabase = await createClient();
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("last_rate_prompt_at, created_at")
    .eq("id", user.user.id)
    .maybeSingle();
  if (!profile) return null;

  const since = profile.last_rate_prompt_at ?? profile.created_at;
  const daysSince = (Date.now() - new Date(since as string).getTime()) / 86_400_000;
  if (daysSince < COOLDOWN_DAYS) return null;

  await supabase.from("profiles").update({ last_rate_prompt_at: new Date().toISOString() }).eq("id", user.user.id);
  return { kind: "rate_app", id: `rate-app-${user.user.id}-${Date.now()}` };
}
