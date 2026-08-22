import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { translateText, TranslationQuotaError } from "@/lib/translate";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { log } from "@/lib/log";
import { captureServerException } from "@/lib/posthog-server";

const RATE_LIMIT_PER_MINUTE = 30;

// P0-АУДИТ 3.2: таблица лимита теперь доступна только service_role — обычный
// пользователь не может сам стереть свою историю запросов через прямой API.
// B.2 (docs/release-2026-08-22/02_KRITICHNYE_BAGI_SEYCHAS.md): P0-АУДИТ 3.3
// reordered this to insert-then-count, which closed the worst case but was
// still, by its own admission, "не идеально атомарно" — a large enough
// concurrent burst could still each read the count before seeing each
// other's inserts and collectively exceed the limit. check_translate_rate_limit
// (0045_atomic_translate_rate_limit.sql) makes insert+count+cleanup one
// atomic unit via a per-owner Postgres advisory lock — this is now a single
// round-trip, not three.
async function checkRateLimit(userId: string): Promise<boolean> {
  const service = createServiceClient();
  const { data, error } = await service.rpc("check_translate_rate_limit", {
    p_owner_id: userId,
    p_limit: RATE_LIMIT_PER_MINUTE,
    p_window_seconds: 60,
  });

  if (error) {
    captureServerException(error, userId, { context: "check_translate_rate_limit" });
    // Fail closed — an rpc error must never silently grant unlimited requests.
    return false;
  }

  return data === true;
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

  // P0-АУДИТ 3.1: запись в общий кэш переводов теперь только через
  // service_role — обычный пользователь больше не может вставить туда
  // произвольный "перевод" напрямую через REST API.
  await createServiceClient()
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
    return NextResponse.json({ error: "Нужно войти в аккаунт." }, { status: 401 });
  }

  const { word, sentence, sourceLang, targetLang } = await request.json();
  if (!word || !sourceLang || !targetLang) {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  const withinLimit = await checkRateLimit(user.id);
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
    captureServerException(e, user.id, { sourceLang, targetLang });
    return NextResponse.json(
      { error: "Не удалось получить перевод, попробуй ещё раз." },
      { status: 502 },
    );
  }
}
