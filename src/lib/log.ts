/**
 * Структурированное логирование ключевых событий (P1-OBS-03): перевод,
 * импорт, подписка. JSON вместо голого console.log — легко парсить в любой
 * лог-агрегатор (Vercel Log Drains, Datadog, etc.) после деплоя.
 */

type LogFields = Record<string, string | number | boolean | null | undefined>;

function emit(level: "info" | "warn" | "error", event: string, fields?: LogFields) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  translation(fields: {
    outcome: "success" | "cached" | "error" | "rate_limited" | "quota";
    latencyMs?: number;
    sourceLang?: string;
    targetLang?: string;
  }) {
    emit(fields.outcome === "error" ? "error" : "info", "translation", fields);
  },
  import(fields: {
    kind: "url" | "youtube" | "photo_text" | "photo_cards" | "csv_json";
    outcome: "success" | "error";
    reason?: string;
  }) {
    emit(fields.outcome === "error" ? "warn" : "info", "import", fields);
  },
  subscription(fields: {
    kind: "checkout_completed" | "invoice_paid" | "payment_failed" | "canceled";
    ownerId?: string;
    plan?: string;
  }) {
    emit("info", "subscription", fields);
  },
};
