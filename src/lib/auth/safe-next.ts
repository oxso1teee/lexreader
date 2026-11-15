// Куда вернуть пользователя после входа (параметр ?next=). Принимаем только
// путь внутри приложения: абсолютные URL, protocol-relative (//host), обратный
// слэш и управляющие символы — это классический open redirect. Страницы
// самой аутентификации исключены: вернуть человека на /login после входа —
// петля.
const PLACEHOLDER_ORIGIN = "http://lexreader.invalid";
const MAX_LENGTH = 512;
const BLOCKED_PREFIXES = ["/login", "/auth", "/api", "/reset-password", "/onboarding"] as const;

function hasForbiddenCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f || code === 0x5c) return true; // управляющие и «\»
  }
  return false;
}

export function safeNextPath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim();
  if (value.length === 0 || value.length > MAX_LENGTH) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (hasForbiddenCharacter(value)) return null;

  let url: URL;
  try {
    url = new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return null;
  }
  // Нормализация (/a/../login → /login) могла увести на другой хост или в
  // служебный маршрут — проверяем уже результат.
  if (url.origin !== PLACEHOLDER_ORIGIN) return null;
  const path = url.pathname;
  if (BLOCKED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) return null;
  return `${path}${url.search}`;
}
