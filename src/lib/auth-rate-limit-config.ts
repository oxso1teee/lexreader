// Вынесено из auth-rate-limit.ts без единого импорта — тот файл тянет
// @/lib/supabase/service (алиас, который понимает только сборка Next.js, не
// голый `node --experimental-strip-types --test`), так что чистую логику
// (namespacing ключей, чтение env-оверрайдов) нужно тестировать отдельно.
const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_MS = 15 * 60_000;

export type AuthAction = "login" | "signup" | "reset-password";

// Раньше login/signup/password-reset делили один и тот же identifier-бакет
// (email становился общим ключом для всех трёх), из-за чего сброс пароля мог
// молча "съесть" оставшиеся попытки входа и наоборот. auth_attempts (миграция
// 0011) хранит identifier как обычный text — префиксация вида "login:email"
// разводит бакеты по типу действия БЕЗ изменения схемы таблицы.
export function authAttemptKey(action: AuthAction, raw: string): string | null {
  const key = raw.trim().toLowerCase();
  return key ? `${action}:${key}` : null;
}

// UNIFIED-UI-SLICE-1 (hosted preview rate-limit audit): значения по
// умолчанию не трогаем нигде — Production их никогда не задаёт, так что там
// поведение байт-в-байт то же самое. Только Preview может (по желанию,
// вручную) выставить более короткие AUTH_RATE_LIMIT_* переменные — это
// server-only env (без NEXT_PUBLIC_), клиенту никогда не попадает.
export function authRateLimitConfig(): { maxAttempts: number; windowMs: number } {
  const rawMax = Number(process.env.AUTH_RATE_LIMIT_MAX_ATTEMPTS);
  const rawWindow = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS);
  return {
    maxAttempts: Number.isFinite(rawMax) && rawMax > 0 ? rawMax : DEFAULT_MAX_ATTEMPTS,
    windowMs: Number.isFinite(rawWindow) && rawWindow > 0 ? rawWindow : DEFAULT_WINDOW_MS,
  };
}
