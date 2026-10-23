"use server";

import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// docs/moments/ROADMAP.md, этап 7 — Notify-ask. push_subscriptions пишется
// существующим savePushSubscription (settings/actions.ts) с того же
// клиентского вызова — здесь только preferred_notify_hour, которого там
// пока нет отдельного сеттера (settings сама не даёт выбрать час).
export async function setPreferredNotifyHourAction(hour: number): Promise<void> {
  const profile = await requireProfile();
  const supabase = await createClient();
  await supabase.from("profiles").update({ preferred_notify_hour: hour }).eq("id", profile.id);
}
