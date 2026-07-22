import { createClient } from "@/lib/supabase/server";

// P1-AUTH-06: «скачать мои данные» — минимальное соответствие праву на
// переносимость данных (GDPR и аналоги). Не включает Stripe customer/
// subscription ID (внутренние идентификаторы платёжного провайдера, не
// нужны пользователю) и уж тем более номера карт (их у нас никогда не было —
// оплата целиком на стороне Stripe).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [profile, texts, vocabulary, decks, flashcards, readingSessions, subscription] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("texts").select("*").eq("owner_id", user.id),
      supabase.from("vocabulary_items").select("*").eq("owner_id", user.id),
      supabase.from("decks").select("*").eq("owner_id", user.id),
      supabase.from("flashcards").select("*").eq("owner_id", user.id),
      supabase.from("reading_sessions").select("*").eq("owner_id", user.id),
      supabase
        .from("subscriptions")
        .select("plan, status, provider, current_period_end")
        .eq("owner_id", user.id)
        .maybeSingle(),
    ]);

  const payload = {
    exported_at: new Date().toISOString(),
    profile: profile.data,
    texts: texts.data ?? [],
    vocabulary: vocabulary.data ?? [],
    decks: decks.data ?? [],
    flashcards: flashcards.data ?? [],
    reading_sessions: readingSessions.data ?? [],
    subscription: subscription.data ?? null,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="lexreader-data-export.json"',
    },
  });
}
