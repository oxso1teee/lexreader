import { createServiceClient } from "@/lib/supabase/service";
import { translateText } from "@/lib/translate";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { captureServerException } from "@/lib/posthog-server";

// Вынесено из app/api/translate/route.ts (раздел C, Тир 3 —
// docs/release-2026-08-22/10_VAU_NOVYE_FICHI_I_DIZAYN.md) — тот же кэш
// переводов и тот же rate-limit теперь используются и обычным Reader'ом
// (cookie-сессия), и новым api/extension/translate-and-save (Bearer-токен
// расширения). Чистый перенос: поведение /api/translate не меняется,
// только источник функций.
const RATE_LIMIT_PER_MINUTE = 30;

// P0-АУДИТ 3.2/3.3 (docs/release-2026-08-22/02_KRITICHNYE_BAGI_SEYCHAS.md B.2): таблица лимита
// доступна только service_role, а сама проверка — один атомарный RPC-вызов
// (0045_atomic_translate_rate_limit.sql) вместо трёх раздельных round-trip'ов.
export async function checkRateLimit(userId: string): Promise<boolean> {
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

export async function cachedTranslate(
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

  // P0-АУДИТ 3.1: запись в общий кэш переводов только через service_role —
  // обычный пользователь не может вставить туда произвольный "перевод"
  // напрямую через REST API.
  await createServiceClient()
    .from("translations_cache")
    .upsert(
      { source_text: text, source_lang: sourceLang, target_lang: targetLang, translation },
      { onConflict: "source_text,source_lang,target_lang", ignoreDuplicates: true },
    );

  return translation;
}
