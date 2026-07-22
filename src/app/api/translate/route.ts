import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { translateText, TranslationQuotaError } from "@/lib/translate";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";

const RATE_LIMIT_PER_MINUTE = 30;

async function checkRateLimit(supabase: SupabaseServerClient, userId: string): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const { count } = await supabase
    .from("translate_requests")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .gte("requested_at", oneMinuteAgo);

  await supabase.from("translate_requests").insert({ owner_id: userId });

  // Периодическая уборка старых записей лога — без отдельного крона.
  if (Math.random() < 0.01) {
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
    await supabase.from("translate_requests").delete().lt("requested_at", oneHourAgo);
  }

  return (count ?? 0) < RATE_LIMIT_PER_MINUTE;
}

async function cachedTranslate(
  supabase: SupabaseServerClient,
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> {
  const { data: cached } = await supabase
    .from("translations_cache")
    .select("translation")
    .eq("source_text", text)
    .eq("source_lang", sourceLang)
    .eq("target_lang", targetLang)
    .maybeSingle();

  if (cached) return cached.translation;

  const translation = await translateText(text, sourceLang, targetLang);

  await supabase
    .from("translations_cache")
    .upsert(
      { source_text: text, source_lang: sourceLang, target_lang: targetLang, translation },
      { onConflict: "source_text,source_lang,target_lang", ignoreDuplicates: true },
    );

  return translation;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { word, sentence, sourceLang, targetLang } = await request.json();
  if (!word || !sourceLang || !targetLang) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const withinLimit = await checkRateLimit(supabase, user.id);
  if (!withinLimit) {
    log.translation({ outcome: "rate_limited", sourceLang, targetLang });
    return NextResponse.json(
      { error: "Слишком много запросов на перевод — попробуй через минуту." },
      { status: 429 },
    );
  }

  const startedAt = Date.now();
  try {
    const [wordTranslation, sentenceTranslation] = await Promise.all([
      cachedTranslate(supabase, word, sourceLang, targetLang),
      sentence ? cachedTranslate(supabase, sentence, sourceLang, targetLang) : Promise.resolve(null),
    ]);

    log.translation({
      outcome: "success",
      latencyMs: Date.now() - startedAt,
      sourceLang,
      targetLang,
    });
    return NextResponse.json({ wordTranslation, sentenceTranslation });
  } catch (e) {
    if (e instanceof TranslationQuotaError) {
      log.translation({ outcome: "quota", sourceLang, targetLang });
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    log.translation({
      outcome: "error",
      latencyMs: Date.now() - startedAt,
      sourceLang,
      targetLang,
    });
    return NextResponse.json(
      { error: "Не удалось получить перевод, попробуй ещё раз." },
      { status: 502 },
    );
  }
}
