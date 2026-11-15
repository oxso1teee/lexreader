// Единое превращение «что-то сломалось» в текст для человека. Копирайт-
// правило проекта (components/product/error-state.tsx): что случилось →
// что можно сделать, без технического жаргона и без утечки внутренностей
// (stack trace, имя провайдера, SQL).
//
// Server actions проекта возвращают { ok: boolean; error?: string } с уже
// человекочитаемым русским текстом — его показываем как есть. Любой Error
// (throw, rejected fetch) — только если это сетевая ошибка, иначе нейтральный
// fallback: сообщения исключений не предназначены для пользователя.

export const FALLBACK_ERROR_MESSAGE = "Что-то пошло не так. Попробуй ещё раз — обычно это временный сбой.";
export const NETWORK_ERROR_MESSAGE = "Нет соединения. Проверь интернет и попробуй снова.";

export interface ActionResult {
  ok: boolean;
  error?: string | null;
}

const NETWORK_PATTERNS = [/failed to fetch/i, /networkerror/i, /network request failed/i, /load failed/i, /fetch failed/i];

export function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError || err instanceof Error) {
    return NETWORK_PATTERNS.some((p) => p.test(err.message));
  }
  return false;
}

function isActionResultLike(value: unknown): value is { error: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error: unknown }).error === "string" &&
    (value as { error: string }).error.trim().length > 0
  );
}

export function getErrorMessage(err: unknown, fallback: string = FALLBACK_ERROR_MESSAGE): string {
  if (typeof err === "string") return err.trim() || fallback;
  if (isActionResultLike(err)) return err.error.trim();
  if (isNetworkError(err)) return NETWORK_ERROR_MESSAGE;
  return fallback;
}
