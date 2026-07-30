import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendPush, type PushSubscriptionRow } from "@/lib/push";
import { computePreferredHour } from "@/lib/notify-timing";
import { log } from "@/lib/log";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// docs/IMPLEMENTATION_PROMPT_2026-07-28.md, раздел 9: тёплая формулировка
// вместо общего "N карточек" — если есть незаконченное чтение, упоминаем его
// по названию вместо generic due-count сообщения.
async function findContinueReading(
  supabase: ReturnType<typeof createServiceClient>,
  ownerId: string,
): Promise<{ title: string; percentLeft: number } | null> {
  const { data } = await supabase
    .from("text_progress")
    .select("percent_read, texts!inner(title)")
    .eq("owner_id", ownerId)
    .gt("percent_read", 4)
    .lt("percent_read", 96)
    .order("last_read_at", { ascending: false })
    .limit(1);
  const row = data?.[0];
  if (!row) return null;
  const text = Array.isArray(row.texts) ? row.texts[0] : row.texts;
  return { title: text.title, percentLeft: 100 - row.percent_read };
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
      } else {
        // P0-АУДИТ: раньше любая другая ошибка (не 404/410) молча
        // проглатывалась — неотличимо от успеха в логах.
        log.error({
          kind: "push_send",
          message: e instanceof Error ? e.message : "unknown",
        });
      }
    }
  }
}

export async function GET(request: Request) {
  // P0-АУДИТ: раньше при отсутствующей CRON_SECRET сравнение превращалось в
  // authHeader !== "Bearer undefined" — предсказуемую строку, которую можно
  // подобрать. Теперь при отсутствующем секрете эндпоинт всегда отклоняет.
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const now = new Date().toISOString();
  const currentHour = new Date().getUTCHours();
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
    // docs/IMPLEMENTATION_PROMPT_2026-07-28.md, раздел 9.2: крон дергается
    // раз в час (см. .github/workflows/push-reminders.yml — Vercel Cron на
    // Hobby-плане не даёт чаще раза в сутки), но каждому пользователю шлём
    // максимум один пуш в сутки, только в его "обычный" час.
    const { data: profile } = await supabase
      .from("profiles")
      .select("last_active_date, preferred_notify_hour")
      .eq("id", ownerId)
      .maybeSingle();
    if (!profile) continue;

    let preferredHour = profile.preferred_notify_hour;
    if (preferredHour === null) {
      preferredHour = await computePreferredHour(supabase, ownerId);
      await supabase.from("profiles").update({ preferred_notify_hour: preferredHour }).eq("id", ownerId);
    }
    if (preferredHour !== currentHour) continue;

    const { count: dueCount } = await supabase
      .from("srs_state")
      .select("flashcard_id, flashcards!inner(owner_id)", { count: "exact", head: true })
      .eq("flashcards.owner_id", ownerId)
      .lte("due_at", now);

    if (dueCount && dueCount > 0) {
      const continueReading = await findContinueReading(supabase, ownerId);
      await sendToAll(supabase, ownerSubs, {
        title: "LexReader",
        body: continueReading
          ? `«${continueReading.title}» ждёт — осталось ${continueReading.percentLeft}%`
          : `У тебя ${dueCount} карточек к повторению`,
        url: continueReading ? "/library" : "/brain/all/review",
      });
      reviewReminders++;
      continue; // повторение важнее напоминания о стрике — не дублировать пуш
    }

    if (profile.last_active_date === yesterday) {
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
