import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPush, type PushSubscriptionRow } from "@/lib/push";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function sendToAll(
  supabase: ReturnType<typeof createServiceClient>,
  subs: PushSubscriptionRow[],
  payload: { title: string; body: string; url?: string },
) {
  for (const sub of subs) {
    try {
      await sendPush(sub, payload);
    } catch (e) {
      const statusCode = (e as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }
  }
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const yesterday = isoDate(new Date(Date.now() - 86_400_000));

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("owner_id, endpoint, p256dh, auth");

  const subsByOwner = new Map<string, PushSubscriptionRow[]>();
  for (const s of subs ?? []) {
    const list = subsByOwner.get(s.owner_id) ?? [];
    list.push({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth });
    subsByOwner.set(s.owner_id, list);
  }

  let reviewReminders = 0;
  let streakReminders = 0;

  for (const [ownerId, ownerSubs] of subsByOwner) {
    const { count: dueCount } = await supabase
      .from("srs_state")
      .select("flashcard_id, flashcards!inner(owner_id)", { count: "exact", head: true })
      .eq("flashcards.owner_id", ownerId)
      .lte("due_at", now);

    if (dueCount && dueCount > 0) {
      await sendToAll(supabase, ownerSubs, {
        title: "LexReader",
        body: `У тебя ${dueCount} карточек к повторению`,
        url: "/brain/all/review",
      });
      reviewReminders++;
      continue; // повторение важнее напоминания о стрике — не дублировать пуш
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("last_active_date")
      .eq("id", ownerId)
      .maybeSingle();

    if (profile?.last_active_date === yesterday) {
      await sendToAll(supabase, ownerSubs, {
        title: "LexReader",
        body: "Не теряй стрик 🔥 — зайди сегодня, чтобы не сбросить счётчик",
        url: "/home",
      });
      streakReminders++;
    }
  }

  return NextResponse.json({ ok: true, reviewReminders, streakReminders });
}
