import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { TranslationQuotaError } from "@/lib/translate";
import { checkRateLimit, cachedTranslate } from "@/lib/translate-request";
import { verifyExtensionToken } from "@/lib/extension-tokens";
import { saveVocabularyItem } from "@/lib/vocabulary";
import { log } from "@/lib/log";
import { captureServerException } from "@/lib/posthog-server";

// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md раздел C, Тир 3 —
// "тап-перевод на любой странице" через браузерное расширение. Тот же
// перевод-в-контексте + сохранение в словарь, что уже даёт Reader (POST
// /api/translate + upsertWord — src/app/read/[textId]/reader.tsx,
// src/app/read/[textId]/actions.ts), но:
//   - аутентификация Bearer-токеном (src/lib/extension-tokens.ts), а не
//     cookie-сессией — у контент-скрипта на стороннем сайте нет открытой
//     залогиненной вкладки LexReader;
//   - один round-trip вместо двух (translate, затем отдельно upsertWord) —
//     контент-скрипту на произвольном DOM выгоднее меньше сетевых вызовов;
//   - только целые слова (не фразы) — тап по фразе на произвольной
//     странице сложнее надёжно выделить вне контролируемого Reader-DOM;
//     осознанно оставлено вне охвата этой фичи (см. PR-описание).
//
// Тот же общий кэш переводов и тот же 30/мин rate-limit
// (check_translate_rate_limit), что и у /api/translate — одна и та же
// квота на пользователя независимо от того, откуда пришёл запрос.

// Bearer-токен — секрет, а не ambient-credential вроде cookie: страница,
// не знающая токен, не может подставить его сама (в отличие от cookie,
// которую браузер прикладывает автоматически) — поэтому CORS здесь не
// защищает от угрозы, для которой он обычно нужен (CSRF через чужой
// cookie-сессии), и его можно безопасно ослабить для этого конкретного
// эндпоинта. Запрос идёт из контекста расширения (chrome-extension://…
// origin), а не с произвольного веб-сайта.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function json(body: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(body, { ...init, headers: { ...CORS_HEADERS, ...init?.headers } });
}

export async function POST(request: Request) {
  const owner = await verifyExtensionToken(request.headers.get("authorization"));
  if (!owner) {
    return json({ error: "Недействительный или отозванный токен расширения." }, { status: 401 });
  }

  let body: { word?: unknown; sentence?: unknown; sourceLang?: unknown; targetLang?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const word = typeof body.word === "string" ? body.word.trim() : "";
  const sentence = typeof body.sentence === "string" ? body.sentence.trim() : "";
  const sourceLang = typeof body.sourceLang === "string" ? body.sourceLang : "";
  const targetLang = typeof body.targetLang === "string" ? body.targetLang : "";
  if (!word || !sourceLang || !targetLang) {
    return json({ error: "Некорректный запрос" }, { status: 400 });
  }
  // Раздел C, Тир 3 — "тап по слову", не по фразе (см. комментарий выше).
  if (/\s/.test(word)) {
    return json({ error: "Расширение сохраняет только отдельные слова." }, { status: 400 });
  }

  const withinLimit = await checkRateLimit(owner.ownerId);
  if (!withinLimit) {
    log.translation({ outcome: "rate_limited", sourceLang, targetLang });
    return json({ error: "Слишком много запросов на перевод — попробуй через минуту." }, { status: 429 });
  }

  // service_role — у запроса нет cookie-сессии/auth.uid(), владелец уже
  // проверен через Bearer-токен выше; каждый вызов ниже явно фильтрует по
  // owner.ownerId (тот же паттерн, что и у cron/push-reminders route).
  const service = createServiceClient();

  const startedAt = Date.now();
  try {
    const [wordTranslation, sentenceTranslation] = await Promise.all([
      cachedTranslate(service, word, sourceLang, targetLang),
      sentence ? cachedTranslate(service, sentence, sourceLang, targetLang) : Promise.resolve(null),
    ]);

    log.translation({ outcome: "success", latencyMs: Date.now() - startedAt, sourceLang, targetLang });

    const saved = await saveVocabularyItem(service, owner.ownerId, {
      textId: null,
      headword: word,
      translation: wordTranslation,
      contextSentence: sentence || null,
      contextTranslation: sentence ? sentenceTranslation : null,
      language: sourceLang,
      sourceType: "extension",
    });
    if (!saved.ok) {
      return json({ error: saved.error ?? "Не удалось сохранить слово.", paywall: saved.paywall }, { status: saved.paywall ? 402 : 500 });
    }

    return json({
      wordTranslation,
      sentenceTranslation,
      id: saved.id,
      level: saved.level,
      seenCount: saved.seenCount,
      flashcardId: saved.flashcardId,
      deckId: saved.deckId,
      learningState: saved.learningState,
      contextCount: saved.contextCount,
    });
  } catch (e) {
    if (e instanceof TranslationQuotaError) {
      log.translation({ outcome: "quota", sourceLang, targetLang });
      return json({ error: e.message }, { status: 503 });
    }
    log.translation({ outcome: "error", latencyMs: Date.now() - startedAt, sourceLang, targetLang });
    captureServerException(e, owner.ownerId, { sourceLang, targetLang, context: "extension_translate_and_save" });
    return json({ error: "Не удалось получить перевод, попробуй ещё раз." }, { status: 502 });
  }
}
