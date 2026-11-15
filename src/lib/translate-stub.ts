// TD-1 — детерминированный «переводчик» для E2E, чтобы CI не зависел от MyMemory.
//
// Все исходящие запросы к внешнему переводчику идут через translateText() (src/lib/translate.ts):
// читалка (/api/translate), расширение (/api/extension/translate-and-save), дуэли, стартовые
// колоды и health-проверка. Поэтому подмена здесь — одно место, покрывающее все пути, и она же
// позволяет настоящему кэшу (translations_cache) работать как в проде: первый запрос — промах
// (провайдер вызван, счётчик растёт), повторный — попадание (ответ тот же, счётчик не растёт).
//
// Включается ТОЛЬКО переменной окружения сервера E2E_TRANSLATE_STUB=1 и никогда в production на
// Vercel (VERCEL_ENV=production) — даже если переменную по ошибке выставили.
//
// Записи, созданные в этом режиме, попадают в translations_cache с пометкой «[stub#N]»: не
// запускайте E2E с этим флагом против базы, которую используете для обычной разработки.

export const TRANSLATE_STUB_FLAG = "E2E_TRANSLATE_STUB";
/** Входы-«триггеры» для проверки обработки ошибок провайдера (подстрока в переводимом тексте). */
export const STUB_QUOTA_TRIGGER = "__stub_quota__";
export const STUB_ERROR_TRIGGER = "__stub_error__";

export function isTranslateStubEnabled(env: Readonly<Record<string, string | undefined>>): boolean {
  return env[TRANSLATE_STUB_FLAG] === "1" && env.VERCEL_ENV !== "production";
}

export type StubResult =
  | { kind: "ok"; translation: string; call: number }
  | { kind: "quota" }
  | { kind: "error" };

/** Отдельный экземпляр на тест; общий (со счётчиком вызовов) — на процесс сервера. */
export function createStubTranslator() {
  let calls = 0;
  return {
    /** Сколько раз «провайдер» реально вызывался (успешные переводы). */
    get calls() {
      return calls;
    },
    next(text: string): StubResult {
      if (text.includes(STUB_QUOTA_TRIGGER)) return { kind: "quota" };
      if (text.includes(STUB_ERROR_TRIGGER)) return { kind: "error" };
      calls += 1;
      return { kind: "ok", translation: `[stub#${calls}] ${text}`, call: calls };
    },
  };
}
