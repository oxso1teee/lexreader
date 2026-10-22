"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { siteUrl } from "@/lib/site-url";
import { describeFriendStreakError } from "@/lib/friend-streaks";
import { requireProfile } from "@/lib/auth";
import { sendPush, type PushSubscriptionRow } from "@/lib/push";

// docs/moments/ROADMAP.md, этап 6 — Friend-streak. Тот же честный MVP, что
// у дуэлей (0050): только "пригласи по ссылке", без списка друзей/поиска
// по email — приватность и отсутствие matchmaking-инфраструктуры важнее
// полноты фичи на этом этапе.

export interface CreateFriendStreakInviteResult {
  ok: boolean;
  error?: string;
  inviteUrl?: string;
}

export async function createFriendStreakInviteAction(): Promise<CreateFriendStreakInviteResult> {
  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("create_friend_streak_invite");
  if (error || !token) return { ok: false, error: describeFriendStreakError(error?.message) };
  return { ok: true, inviteUrl: `${siteUrl()}/friends/${token}` };
}

export async function acceptFriendStreakInviteAction(token: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_friend_streak_invite", { p_token: token });
  if (error) {
    redirect(`/friends/${token}?error=${encodeURIComponent(describeFriendStreakError(error.message))}`);
  }
  redirect("/streak");
}

// docs/moments/ROADMAP.md, этап 6 — Friend-streak, кнопка "Позвать".
// push_subscriptions — владельческая RLS (owner_id = auth.uid()), а мы
// шлём пуш ЧУЖОМУ пользователю (партнёру по friend_streaks) — тот же
// паттерн elevated-доступа, что api/cron/push-reminders/route.ts
// (service_role, а не обычный клиент текущей сессии).
export async function remindFriendAction(partnerId: string): Promise<{ ok: boolean }> {
  // requireProfile() — только чтобы гарантировать, что вызывающий сам
  // залогинен (service_role ниже не проверяет сессию сам по себе);
  // profiles не хранит email/имя (0049: "ни email, ни какое-либо
  // 'настоящее имя' никогда не возвращаются"), поэтому пуш без имени.
  await requireProfile();
  const service = createServiceClient();

  const { data: subs } = await service.from("push_subscriptions").select("endpoint, p256dh, auth").eq("owner_id", partnerId);
  for (const sub of (subs ?? []) as PushSubscriptionRow[]) {
    try {
      await sendPush(sub, { title: "LexReader", body: "Друг ждёт тебя в общей серии — не дай ей погаснуть", url: "/streak" });
    } catch (e) {
      const statusCode = (e as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await service.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }
  }
  return { ok: true };
}
