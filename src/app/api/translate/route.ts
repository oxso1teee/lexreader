import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TranslationQuotaError } from "@/lib/translate";
import { checkRateLimit, cachedTranslate } from "@/lib/translate-request";
import { log } from "@/lib/log";
import { captureServerException } from "@/lib/posthog-server";

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
